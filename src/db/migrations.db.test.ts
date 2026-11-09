// The migrations that add the owner to the data (see decision 8 in openspec/changes/archive/2026-11-09-login/design.md),
// run on databases that already hold data, the way they run on the server.
// Every test makes databases of its own, so it does not touch the common test database.

import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runMigrations } from "../../scripts/run-migrations";
import { databaseName, serverUrl, testDatabaseUrl } from "../../test-db/database-url.mts";

const OWNER_ERROR = "OWNER_EMAIL is not set: existing contacts and groups need an owner";

type Journal = { entries: { tag: string }[] };

const created: string[] = [];
const folders: string[] = [];
let admin: postgres.Sql;
let counter = 0;

beforeAll(() => {
  admin = postgres(serverUrl(testDatabaseUrl()), { max: 1, onnotice: () => {} });
});

afterAll(async () => {
  for (const name of created) {
    await admin.unsafe(`drop database if exists "${name}" with (force)`);
  }
  await admin.end();
  for (const folder of folders) rmSync(folder, { recursive: true, force: true });
});

// A new empty database; the name ends with "_test", like every database these tests touch
async function newDatabase() {
  const base = databaseName(testDatabaseUrl()).replace(/_test$/, "");
  const name = `${base}_migration${++counter}_test`;
  await admin.unsafe(`drop database if exists "${name}" with (force)`);
  await admin.unsafe(`create database "${name}"`);
  created.push(name);
  const url = new URL(testDatabaseUrl());
  url.pathname = `/${name}`;
  return url.toString();
}

// The migrations folder cut after the first `count` migrations: the database as it was in the past
function migrationsUpTo(count: number) {
  const folder = mkdtempSync(join(tmpdir(), "migrations-"));
  folders.push(folder);
  cpSync("drizzle", folder, { recursive: true });
  const journalPath = join(folder, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as Journal;
  journal.entries = journal.entries.slice(0, count);
  writeFileSync(journalPath, JSON.stringify(journal));
  return folder;
}

// Migrations 0000-0002: the app as it was before the login
const BEFORE_LOGIN = 3;
// ... and with the tables of the login (0003), before the data got an owner
const WITH_LOGIN_TABLES = 4;

// Contacts, notes, groups and links to groups, as in the old database
async function fillOldData(url: string) {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql`insert into contacts (name) values ('Анна'), ('Борис'), ('Вера')`;
    await sql`insert into notes (contact_id, body) select id, 'заметка' from contacts`;
    await sql`insert into notes (contact_id, body) select id, 'ещё заметка' from contacts where name = 'Анна'`;
    await sql`insert into groups (name) values ('Друзья'), ('Теннис')`;
    await sql`insert into contact_groups (contact_id, group_id) select c.id, g.id from contacts c, groups g where c.name <> 'Вера'`;
  } finally {
    await sql.end();
  }
}

async function oneRow<T>(url: string, query: (sql: postgres.Sql) => Promise<T[]>) {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    return (await query(sql))[0];
  } finally {
    await sql.end();
  }
}

function counts(url: string) {
  return oneRow(
    url,
    (sql) => sql`
      select (select count(*)::int from contacts) as contacts,
             (select count(*)::int from notes) as notes,
             (select count(*)::int from groups) as groups,
             (select count(*)::int from contact_groups) as links`,
  );
}

describe("migrations 0003 and 0004 on a database with data", () => {
  it("keep the number of contacts, notes, groups and links", async () => {
    const url = await newDatabase();
    await runMigrations(url, { migrationsFolder: migrationsUpTo(BEFORE_LOGIN) });
    await fillOldData(url);
    const before = await counts(url);

    await runMigrations(url, { ownerEmail: "owner@example.com" });

    expect(before).toEqual({ contacts: 3, notes: 4, groups: 2, links: 4 });
    expect(await counts(url)).toEqual(before);
  });

  it("give everything to the user with the address, written without spaces and in lower case", async () => {
    const url = await newDatabase();
    await runMigrations(url, { migrationsFolder: migrationsUpTo(BEFORE_LOGIN) });
    await fillOldData(url);

    await runMigrations(url, { ownerEmail: "  Owner@Example.COM " });

    const result = await oneRow(
      url,
      (sql) => sql`
        select (select count(*)::int from users) as users,
               (select email from users) as email,
               (select count(*)::int from contacts where owner_id = (select id from users)) as contacts,
               (select count(*)::int from groups where owner_id = (select id from users)) as groups`,
    );
    expect(result).toEqual({ users: 1, email: "owner@example.com", contacts: 3, groups: 2 });
  });

  it("take the user with this address if he already exists", async () => {
    const url = await newDatabase();
    await runMigrations(url, { migrationsFolder: migrationsUpTo(WITH_LOGIN_TABLES) });
    await fillOldData(url);
    await oneRow(
      url,
      (sql) => sql`insert into users (id, name, email, email_verified)
                   values ('existing-owner', '', 'owner@example.com', true) returning id`,
    );

    await runMigrations(url, { ownerEmail: "Owner@example.com" });

    const result = await oneRow(
      url,
      (sql) => sql`
        select (select count(*)::int from users) as users,
               (select count(*)::int from contacts where owner_id = 'existing-owner') as contacts,
               (select count(*)::int from groups where owner_id = 'existing-owner') as groups`,
    );
    expect(result).toEqual({ users: 1, contacts: 3, groups: 2 });
  });

  it("stop with an error when there is data and no address, and leave the database as it was", async () => {
    const url = await newDatabase();
    await runMigrations(url, { migrationsFolder: migrationsUpTo(BEFORE_LOGIN) });
    await fillOldData(url);
    const before = await counts(url);

    await expect(runMigrations(url)).rejects.toThrow(OWNER_ERROR);
    await expect(runMigrations(url, { ownerEmail: "   " })).rejects.toThrow(OWNER_ERROR);

    expect(await counts(url)).toEqual(before);
    const state = await oneRow(
      url,
      (sql) => sql`
        select to_regclass('public.users') is null as no_users_table,
               to_regclass('public.login_links') is null as no_login_links_table,
               not exists (select 1 from information_schema.columns
                           where table_name = 'contacts' and column_name = 'owner_id') as no_owner_column,
               (select count(*)::int from drizzle.__drizzle_migrations) as migrations`,
    );
    expect(state).toEqual({
      no_users_table: true,
      no_login_links_table: true,
      no_owner_column: true,
      migrations: BEFORE_LOGIN,
    });
  });

  it("stop when there are only groups and no address", async () => {
    const url = await newDatabase();
    await runMigrations(url, { migrationsFolder: migrationsUpTo(BEFORE_LOGIN) });
    await oneRow(url, (sql) => sql`insert into groups (name) values ('Друзья') returning id`);

    await expect(runMigrations(url)).rejects.toThrow(OWNER_ERROR);
  });

  it("pass on an empty database without an address", async () => {
    const url = await newDatabase();

    await expect(runMigrations(url)).resolves.toMatchObject({ applied: expect.any(Number) });

    const result = await oneRow(url, (sql) => sql`select count(*)::int as users from users`);
    expect(result.users).toBe(0);
  });

  it("let two users have a group of the same name, but not one user", async () => {
    const url = await newDatabase();
    await runMigrations(url);
    await oneRow(
      url,
      (sql) =>
        sql`insert into users (id, name, email) values ('a', '', 'a@example.com'), ('b', '', 'b@example.com') returning id`,
    );

    await oneRow(
      url,
      (sql) => sql`insert into groups (name, owner_id) values ('Друзья', 'a') returning id`,
    );
    await oneRow(
      url,
      (sql) => sql`insert into groups (name, owner_id) values ('Друзья', 'b') returning id`,
    );

    await expect(
      oneRow(
        url,
        (sql) => sql`insert into groups (name, owner_id) values ('друзья', 'a') returning id`,
      ),
    ).rejects.toThrow();
    await expect(
      oneRow(
        url,
        (sql) =>
          sql`insert into groups (name, owner_id) values ('Тётя', 'a'), ('тетя', 'a') returning id`,
      ),
    ).rejects.toThrow();
  });
});
