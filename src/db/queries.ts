import "server-only";

import { and, count, desc, eq, sql, type SQL } from "drizzle-orm";
import { cache } from "react";

import { db } from "./index";
import { contacts, notes } from "./schema";

// Alphabetical order by Russian rules: Cyrillic first, "ё" sorted together with "е"
const nameOrder = sql`${contacts.name} collate "ru-RU-x-icu"`;

// Case-insensitive name with "ё" folded into "е", so "Семен" finds "Семён"
const normalizedName = sql`replace(lower(${contacts.name}), 'ё', 'е')`;

function normalizeSearchWord(word: string) {
  return word.toLowerCase().replaceAll("ё", "е");
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function nameSearchCondition(query: string): SQL | undefined {
  // Every word must be found somewhere in the name: "Иван Пет" finds "Иван Петров"
  const words = query.trim().split(/\s+/).filter(Boolean).slice(0, 10);
  if (words.length === 0) return undefined;
  return and(
    ...words.map(
      (word) => sql`${normalizedName} like ${`%${escapeLike(normalizeSearchWord(word))}%`}`,
    ),
  );
}

export async function listContacts(query = "") {
  return db
    .select({
      id: contacts.id,
      name: contacts.name,
      about: contacts.about,
      phone: contacts.phone,
      email: contacts.email,
    })
    .from(contacts)
    .where(nameSearchCondition(query))
    .orderBy(nameOrder, contacts.id);
}

export type ContactListItem = Awaited<ReturnType<typeof listContacts>>[number];

export async function countContacts() {
  const [row] = await db.select({ total: count() }).from(contacts);
  return row.total;
}

// Cached per request: the page and its metadata both read the same contact
export const getContact = cache(async (id: number) => {
  const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
  return contact;
});

export async function listNotes(contactId: number) {
  return db
    .select()
    .from(notes)
    .where(eq(notes.contactId, contactId))
    .orderBy(desc(notes.createdAt), desc(notes.id));
}
