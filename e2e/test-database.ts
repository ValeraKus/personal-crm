// The e2e tests use a real PostgreSQL, but a separate database on the same server:
// the name from DATABASE_URL plus "_e2e". It is created from scratch on every run
// (see prepare-database.ts), so the tests never touch the contacts you keep for yourself.

import { loadEnvConfig } from "@next/env";
import { count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { contacts } from "../src/db/schema";

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

export async function insertContacts(names: string[]) {
  await withTestDb((db) => db.insert(contacts).values(names.map((name) => ({ name }))));
}

export async function countContacts() {
  return withTestDb(async (db) => {
    const [{ total }] = await db.select({ total: count() }).from(contacts);
    return total;
  });
}
