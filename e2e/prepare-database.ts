// Makes the e2e database empty before the app starts for the tests (see playwright.config.ts):
// drops the one left from the previous run and creates it again. Migrations are applied after it
// by scripts/migrate.ts, the same script that migrates the server database.
// It refuses to drop a database whose name does not end with "_e2e".

import postgres from "postgres";

import { databaseName, isTestDatabase, testDatabaseUrl } from "./test-database";

async function main() {
  const databaseUrl = testDatabaseUrl();
  const name = databaseName(databaseUrl);
  if (!isTestDatabase(databaseUrl) || !/^[A-Za-z0-9_]+$/.test(name)) {
    throw new Error(`Refusing to recreate database "${name}": it is not an e2e test database`);
  }

  // DROP and CREATE DATABASE run from another database of the same server: "postgres" always exists
  const serverUrl = new URL(databaseUrl);
  serverUrl.pathname = "/postgres";
  const sql = postgres(serverUrl.toString(), { max: 1, onnotice: () => {} });

  try {
    await sql.unsafe(`drop database if exists "${name}" with (force)`);
    await sql.unsafe(`create database "${name}"`);
    console.log(`Test database "${name}" is created empty.`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
