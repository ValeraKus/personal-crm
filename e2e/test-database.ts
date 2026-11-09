// The e2e tests use a real PostgreSQL, but a separate database on the same server:
// the name from DATABASE_URL plus "_e2e". It is created from scratch on every run
// (see prepare-database.ts), so the tests never touch the contacts you keep for yourself.

import { loadEnvConfig } from "@next/env";
import { count, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { contactGroups, contacts, groups, notes, users } from "../src/db/schema";
import type { Frequency } from "../src/lib/keep-in-touch";

const TEST_DATABASE_SUFFIX = "_e2e";

// Read .env the same way Next.js does, without printing which files were loaded
loadEnvConfig(process.cwd(), false, { info: () => {}, error: console.error });

export function databaseName(databaseUrl: string) {
  return decodeURIComponent(new URL(databaseUrl).pathname.slice(1));
}

export function isTestDatabase(databaseUrl: string) {
  return databaseName(databaseUrl).endsWith(TEST_DATABASE_SUFFIX);
}

// DATABASE_URL with the database name changed to <name>_e2e.
// A URL that already points to the test database is returned as it is.
export function testDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set: copy .env.example to .env and fill it in");
  }
  if (isTestDatabase(databaseUrl)) return databaseUrl;

  const url = new URL(databaseUrl);
  url.pathname = `/${encodeURIComponent(databaseName(databaseUrl) + TEST_DATABASE_SUFFIX)}`;
  return url.toString();
}

// Tests put their starting data straight into the database; everything they check goes through the UI
async function withTestDb<T>(run: (db: ReturnType<typeof drizzle>) => Promise<T>) {
  const sql = postgres(testDatabaseUrl(), { max: 1, onnotice: () => {} });
  try {
    return await run(drizzle(sql));
  } finally {
    await sql.end();
  }
}

// The tests put their starting data to the user of the test and count only his contacts: every
// test signs in under an address of its own (see fixtures.ts), so data of other tests is not seen.
// The fixture says whose data it is. Playwright runs the tests of this project one after another
// in one process (workers: 1), so one variable is enough.
let currentOwnerEmail: string | undefined;

export function actAs(email: string) {
  currentOwnerEmail = email;
}

async function currentOwnerId(db: ReturnType<typeof drizzle>) {
  if (!currentOwnerEmail) throw new Error("No user for the test data: sign in first (fixtures.ts)");
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, currentOwnerEmail));
  if (!user) throw new Error(`The user ${currentOwnerEmail} does not exist yet: sign in first`);
  return user.id;
}

export async function insertContacts(names: string[]) {
  await withTestDb(async (db) => {
    const ownerId = await currentOwnerId(db);
    await db.insert(contacts).values(names.map((name) => ({ name, ownerId })));
  });
}

type ContactSeed = {
  name: string;
  phone?: string;
  frequency?: Frequency;
  // N of the custom term, only with the "days" frequency
  days?: number;
  // When the frequency was set: required with a frequency, the term counts from it if there are no notes
  since?: Date;
  notes?: { body: string; createdAt: Date }[];
  // Groups of the contact, from insertGroup
  groupIds?: number[];
};

// A contact with its term and notes already in the past: the only way to get an overdue contact
export async function insertContact(seed: ContactSeed) {
  return withTestDb(async (db) => {
    const ownerId = await currentOwnerId(db);
    const [contact] = await db
      .insert(contacts)
      .values({
        ownerId,
        name: seed.name,
        phone: seed.phone ?? null,
        keepInTouchFrequency: seed.frequency ?? null,
        keepInTouchDays: seed.days ?? null,
        keepInTouchSince: seed.since ?? null,
      })
      .returning({ id: contacts.id });
    if (seed.notes?.length) {
      await db.insert(notes).values(seed.notes.map((note) => ({ contactId: contact.id, ...note })));
    }
    if (seed.groupIds?.length) {
      await db
        .insert(contactGroups)
        .values(seed.groupIds.map((groupId) => ({ contactId: contact.id, groupId })));
    }
    return contact.id;
  });
}

export async function insertGroup(name: string) {
  return withTestDb(async (db) => {
    const ownerId = await currentOwnerId(db);
    const [group] = await db.insert(groups).values({ ownerId, name }).returning({ id: groups.id });
    return group.id;
  });
}

export async function countContacts() {
  return withTestDb(async (db) => {
    const ownerId = await currentOwnerId(db);
    const [{ total }] = await db
      .select({ total: count() })
      .from(contacts)
      .where(eq(contacts.ownerId, ownerId));
    return total;
  });
}

// Time travel for the login tests: the tests move the time of links and sessions back in the
// database, like the tests of «Пора связаться» put dates in the past. Waiting 15 minutes or 30 days
// for real is not possible.

// The link of the address is old: the 15 minutes of the link have passed
export async function expireLoginLink(email: string) {
  await withTestDb((db) =>
    db.execute(
      sql`update verifications set expires_at = now() - interval '1 minute' where value like ${`%"${email}"%`}`,
    ),
  );
}

// The emails of the address were sent that long ago, e.g. "11 minutes"
export async function ageSentLinks(email: string, interval: string) {
  await withTestDb((db) =>
    db.execute(
      sql`update login_links set created_at = created_at - ${interval}::interval where email = ${email}`,
    ),
  );
}

// The user was last here that long ago: the session has not been renewed for `since` ("2 days")
// and ends in 30 days after that day, as Better Auth sets it. `since` of "31 days" is an expired session.
export async function setLastVisit(email: string, since: string) {
  await withTestDb((db) =>
    db.execute(sql`
      update sessions
      set updated_at = now() - ${since}::interval,
          expires_at = now() - ${since}::interval + interval '30 days'
      where user_id = (select id from users where email = ${email})
    `),
  );
}

// When the sessions of the user end: the latest of them
export async function sessionEndsAt(email: string) {
  return withTestDb(async (db) => {
    const rows = await db.execute<{ expires_at: Date }>(sql`
      select max(expires_at) as expires_at from sessions
      where user_id = (select id from users where email = ${email})
    `);
    return new Date(rows[0].expires_at);
  });
}

export async function countUsers(email: string) {
  return withTestDb(async (db) => {
    const rows = await db.execute<{ total: number }>(
      sql`select count(*)::int as total from users where email = ${email}`,
    );
    return rows[0].total;
  });
}

// Makes the keep-in-touch term of the contact end in the past: the term counts from the day the
// frequency was set, so this is how a test gets an overdue contact through the UI alone
export async function makeOverdue(name: string) {
  await withTestDb((db) =>
    db.execute(
      sql`update contacts set keep_in_touch_since = now() - interval '60 days' where name = ${name}`,
    ),
  );
}
