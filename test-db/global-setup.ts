// Runs once before the database tests (see vitest.db.config.mts): drops the test database left from
// the previous run, creates it empty and applies the migrations, the same ones as on the server.
// It refuses to drop a database whose name does not end with "_test".

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { databaseName, isTestDatabase, serverUrl, testDatabaseUrl } from "./database-url.mts";

export async function setup() {
  const databaseUrl = testDatabaseUrl();
  const name = databaseName(databaseUrl);
  if (!isTestDatabase(databaseUrl) || !/^[A-Za-z0-9_]+$/.test(name)) {
    throw new Error(`Refusing to recreate database "${name}": it is not a database test database`);
  }

  const admin = postgres(serverUrl(databaseUrl), { max: 1, onnotice: () => {} });
  try {
    await admin.unsafe(`drop database if exists "${name}" with (force)`);
    await admin.unsafe(`create database "${name}"`);
  } finally {
    await admin.end();
  }

  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(sql), { migrationsFolder: "drizzle" });
  } finally {
    await sql.end();
  }
}
