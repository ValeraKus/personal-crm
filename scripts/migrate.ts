// Applies pending migrations from ./drizzle and exits.
// On the server it runs as a one-off container from the app image before the new app starts.
// Locally `pnpm db:migrate` runs this same script.
// OWNER_EMAIL is the address that gets the contacts and groups that existed before the login:
// it is needed only when the database already holds some (see the migration that adds owner_id).

import { loadEnvConfig } from "@next/env";

import { runMigrations } from "./run-migrations";

loadEnvConfig(process.cwd());

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set: copy .env.example to .env and fill it in");
  }

  const { applied, total } = await runMigrations(databaseUrl, {
    ownerEmail: process.env.OWNER_EMAIL,
  });
  console.log(`Migrations: ${applied} applied now, ${total} in the database.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
