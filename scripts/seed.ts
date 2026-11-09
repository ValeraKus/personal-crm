// Fills the database with fictional contacts of the owner: pnpm db:seed
// The owner is the address OWNER_EMAIL from .env. The command never deletes or overwrites
// anything: if the owner already has contacts, it does nothing.

import { loadEnvConfig } from "@next/env";

import { seedDemoData } from "./seed-demo";

loadEnvConfig(process.cwd());

async function main() {
  const result = await seedDemoData(process.env.OWNER_EMAIL ?? "");

  if (result.status === "skipped") {
    console.log(
      `The owner already has ${result.contacts} contacts: seeding skipped, nothing changed.`,
    );
  } else {
    console.log(`Seeded ${result.contacts} contacts and ${result.notes} notes.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
