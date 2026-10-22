import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

// Reuse one connection pool across hot reloads in development
const globalForDb = globalThis as unknown as { sql?: postgres.Sql };

function createDb() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set: copy .env.example to .env and fill it in");
  }

  const sql = globalForDb.sql ?? postgres(databaseUrl, { max: 10 });
  if (process.env.NODE_ENV !== "production") {
    globalForDb.sql = sql;
  }
  return drizzle(sql, { schema });
}

let db: ReturnType<typeof createDb> | undefined;

// Created on the first query, not on import: `next build` loads every page module
// and runs without DATABASE_URL
export function getDb() {
  db ??= createDb();
  return db;
}
