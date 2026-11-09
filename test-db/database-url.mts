// The database tests (pnpm test:db) use a real PostgreSQL, but a database of their own on the same
// server: the name from DATABASE_URL plus "_test". It is created from scratch on every run
// (see global-setup.ts), so the tests never touch the contacts you keep for yourself.

import nextEnv from "@next/env";

const TEST_DATABASE_SUFFIX = "_test";

// Read .env the same way Next.js does, without printing which files were loaded.
// @next/env is a CommonJS package: Vitest loads its config as ESM, so no named import here.
nextEnv.loadEnvConfig(process.cwd(), false, { info: () => {}, error: console.error });

export function databaseName(databaseUrl: string) {
  return decodeURIComponent(new URL(databaseUrl).pathname.slice(1));
}

export function isTestDatabase(databaseUrl: string) {
  return databaseName(databaseUrl).endsWith(TEST_DATABASE_SUFFIX);
}

// DATABASE_URL with the database name changed to <name>_test.
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

// The same server, another database: DROP and CREATE DATABASE cannot run inside the database itself.
// "postgres" always exists.
export function serverUrl(databaseUrl: string) {
  const url = new URL(databaseUrl);
  url.pathname = "/postgres";
  return url.toString();
}
