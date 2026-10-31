import "server-only";

import {
  and,
  count,
  desc,
  eq,
  isNotNull,
  max,
  sql,
  type SQL,
} from "drizzle-orm";
import { cache } from "react";

import { getDb } from "./index";
import { contactGroups, contacts, groups, notes } from "./schema";

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
      (word) =>
        sql`${normalizedName} like ${`%${escapeLike(normalizeSearchWord(word))}%`}`,
    ),
  );
}

// A contact must be in every selected group: one EXISTS per group, joined with AND
function groupsCondition(groupIds: number[]): SQL | undefined {
  if (groupIds.length === 0) return undefined;
  return and(
    ...groupIds.map(
      (groupId) => sql`exists (
        select 1 from ${contactGroups}
        where ${contactGroups.contactId} = ${contacts.id} and ${contactGroups.groupId} = ${groupId}
      )`,
    ),
  );
}

export async function listContacts(query = "", groupIds: number[] = []) {
  return getDb()
    .select({
      id: contacts.id,
      name: contacts.name,
      about: contacts.about,
      phone: contacts.phone,
      email: contacts.email,
    })
    .from(contacts)
    .where(and(nameSearchCondition(query), groupsCondition(groupIds)))
    .orderBy(nameOrder, contacts.id);
}

export type ContactListItem = Awaited<ReturnType<typeof listContacts>>[number];

export async function countContacts() {
  const [row] = await getDb().select({ total: count() }).from(contacts);
  return row.total;
}

// Cached per request: the page and its metadata both read the same contact
export const getContact = cache(async (id: number) => {
  const [contact] = await getDb()
    .select()
    .from(contacts)
    .where(eq(contacts.id, id));
  return contact;
});

export async function listNotes(contactId: number) {
  return getDb()
    .select()
    .from(notes)
    .where(eq(notes.contactId, contactId))
    .orderBy(desc(notes.createdAt), desc(notes.id));
}

// Contacts with a frequency and the date of the last note, in the order of the general list.
// Which of them are overdue is decided by getTermStatus: one set of rules for the block and the card.
export async function listContactsWithTerm() {
  return getDb()
    .select({
      id: contacts.id,
      name: contacts.name,
      keepInTouchFrequency: contacts.keepInTouchFrequency,
      keepInTouchDays: contacts.keepInTouchDays,
      keepInTouchSince: contacts.keepInTouchSince,
      lastNoteAt: max(notes.createdAt),
    })
    .from(contacts)
    .leftJoin(notes, eq(notes.contactId, contacts.id))
    .where(isNotNull(contacts.keepInTouchFrequency))
    .groupBy(contacts.id)
    .orderBy(nameOrder, contacts.id);
}

// Same alphabetical rules as the contact list
const groupNameOrder = sql`${groups.name} collate "ru-RU-x-icu"`;

export async function listGroups() {
  return getDb()
    .select({ id: groups.id, name: groups.name })
    .from(groups)
    .orderBy(groupNameOrder, groups.id);
}

export async function listContactGroups(contactId: number) {
  return getDb()
    .select({ id: groups.id, name: groups.name })
    .from(contactGroups)
    .innerJoin(groups, eq(groups.id, contactGroups.groupId))
    .where(eq(contactGroups.contactId, contactId))
    .orderBy(groupNameOrder, groups.id);
}

export async function listGroupsWithCounts() {
  return getDb()
    .select({
      id: groups.id,
      name: groups.name,
      contactCount: count(contactGroups.contactId),
    })
    .from(groups)
    .leftJoin(contactGroups, eq(contactGroups.groupId, groups.id))
    .groupBy(groups.id)
    .orderBy(groupNameOrder, groups.id);
}
