// Applies pending migrations from ./drizzle and exits.
// On the server it runs as a one-off container from the app image before the new app starts.
// Locally `pnpm db:migrate` (drizzle-kit) applies the same migrations.

import { loadEnvConfig } from "@next/env";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

loadEnvConfig(process.cwd());

async function appliedCount(sql: postgres.Sql) {
  const [{ exists }] = await sql`
    select to_regclass('drizzle.__drizzle_migrations') is not null as exists
  `;
  if (!exists) return 0;
  const [{ total }] = await sql`select count(*)::int as total from drizzle.__drizzle_migrations`;
  return total as number;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set: copy .env.example to .env and fill it in");
  }

  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });

  try {
    const before = await appliedCount(sql);
    await migrate(drizzle(sql), { migrationsFolder: "drizzle" });
    const after = await appliedCount(sql);
    console.log(`Migrations: ${after - before} applied now, ${after} in the database.`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
