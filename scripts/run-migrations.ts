// Applies the pending migrations of a folder to a database. Used by scripts/migrate.ts (the server
// and `pnpm db:migrate`) and by the migration tests, so the tests run the code that runs on the server.

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function appliedCount(sql: postgres.Sql) {
  const [{ exists }] = await sql`
    select to_regclass('drizzle.__drizzle_migrations') is not null as exists
  `;
  if (!exists) return 0;
  const [{ total }] = await sql`select count(*)::int as total from drizzle.__drizzle_migrations`;
  return total as number;
}

type Options = {
  // The address of the owner of the contacts and groups that already exist (OWNER_EMAIL). The
  // migration that gives the data an owner reads it from the setting app.owner_email.
  ownerEmail?: string;
  migrationsFolder?: string;
};

export async function runMigrations(databaseUrl: string, options: Options = {}) {
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });

  try {
    // One connection for everything, so the setting is there for every migration. It is not
    // written to the database: only this connection has it.
    if (options.ownerEmail) {
      await sql`select set_config('app.owner_email', ${options.ownerEmail}, false)`;
    }
    const before = await appliedCount(sql);
    await migrate(drizzle(sql), { migrationsFolder: options.migrationsFolder ?? "drizzle" });
    const after = await appliedCount(sql);
    return { applied: after - before, total: after };
  } finally {
    await sql.end();
  }
}
