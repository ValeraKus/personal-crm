// Fills an empty database with fictional contacts: pnpm db:seed
// It never deletes or overwrites anything: if contacts already exist, it does nothing.

import { loadEnvConfig } from "@next/env";
import { count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { contacts, notes } from "../src/db/schema";
import { generatePeople } from "./seed-data";

const CONTACT_COUNT = 1000;
const BATCH_SIZE = 250;

loadEnvConfig(process.cwd());

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set: copy .env.example to .env and fill it in");
  }

  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  const db = drizzle(sql);

  try {
    const [{ total }] = await db.select({ total: count() }).from(contacts);
    if (total > 0) {
      console.log(`Database already has ${total} contacts: seeding skipped, nothing changed.`);
      return;
    }

    const people = generatePeople(CONTACT_COUNT, new Date());
    let noteTotal = 0;

    await db.transaction(async (tx) => {
      for (const batch of chunk(people, BATCH_SIZE)) {
        const inserted = await tx
          .insert(contacts)
          .values(batch.map((person) => person.contact))
          .returning({ id: contacts.id });

        const noteRows = batch.flatMap((person, index) =>
          person.notes.map((note) => ({ ...note, contactId: inserted[index].id })),
        );
        if (noteRows.length > 0) {
          await tx.insert(notes).values(noteRows);
        }
        noteTotal += noteRows.length;
      }
    });

    console.log(`Seeded ${people.length} contacts and ${noteTotal} notes.`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
