// Fills the database with fictional contacts of the owner of the app. Used by scripts/seed.ts
// (pnpm db:seed, and on the server) and by the tests on the database.
// It never deletes or overwrites anything: if the owner already has contacts, it does nothing.

import { randomUUID } from "node:crypto";

import { count, eq, sql as rawSql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { contacts, notes, users } from "../src/db/schema";
import { generatePeople } from "./seed-data";

const DEFAULT_CONTACT_COUNT = 1000;
const BATCH_SIZE = 250;

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export type SeedResult =
  { status: "seeded"; contacts: number; notes: number } | { status: "skipped"; contacts: number };

type Options = { count?: number; now?: Date };

// The owner is the user with the address OWNER_EMAIL: created here if he has not signed in yet.
// The contacts go to him, so nobody else sees them.
export async function seedDemoData(ownerEmail: string, options: Options = {}): Promise<SeedResult> {
  const email = ownerEmail.trim().toLowerCase();
  if (!email) {
    throw new Error("OWNER_EMAIL is not set: the demo contacts need an owner, see .env.example");
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set: copy .env.example to .env and fill it in");
  }

  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  const db = drizzle(sql);

  try {
    return await db.transaction(async (tx) => {
      // Two seeds at the same moment: the second waits and then sees the contacts of the first
      await tx.execute(rawSql`select pg_advisory_xact_lock(hashtext(${email}))`);

      await tx
        .insert(users)
        .values({ id: randomUUID(), name: "", email, emailVerified: true })
        .onConflictDoNothing({ target: users.email });
      const [owner] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email));

      const [{ total }] = await tx
        .select({ total: count() })
        .from(contacts)
        .where(eq(contacts.ownerId, owner.id));
      if (total > 0) return { status: "skipped" as const, contacts: total };

      const people = generatePeople(
        options.count ?? DEFAULT_CONTACT_COUNT,
        options.now ?? new Date(),
      );
      let noteTotal = 0;
      for (const batch of chunk(people, BATCH_SIZE)) {
        const inserted = await tx
          .insert(contacts)
          .values(batch.map((person) => ({ ...person.contact, ownerId: owner.id })))
          .returning({ id: contacts.id });

        const noteRows = batch.flatMap((person, index) =>
          person.notes.map((note) => ({ ...note, contactId: inserted[index].id })),
        );
        if (noteRows.length > 0) {
          await tx.insert(notes).values(noteRows);
        }
        noteTotal += noteRows.length;
      }
      return { status: "seeded" as const, contacts: people.length, notes: noteTotal };
    });
  } finally {
    await sql.end();
  }
}
