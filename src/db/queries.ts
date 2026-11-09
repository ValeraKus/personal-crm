import "server-only";

import { and, count, desc, eq, isNotNull, max, sql, type SQL } from "drizzle-orm";
import { cache } from "react";

import { getDb } from "./index";
import { contactGroups, contacts, groups, notes } from "./schema";

// Every read here takes the owner as the first argument and returns only his data: no function
// reads "everything". The notes and the links to groups have no owner of their own: they belong to
// the owner of their contact, so they are reached only through a contact of this owner.

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

export async function listContacts(ownerId: string, query = "", groupIds: number[] = []) {
  return getDb()
    .select({
      id: contacts.id,
      name: contacts.name,
      about: contacts.about,
      phone: contacts.phone,
      email: contacts.email,
    })
    .from(contacts)
    .where(
      and(eq(contacts.ownerId, ownerId), nameSearchCondition(query), groupsCondition(groupIds)),
    )
    .orderBy(nameOrder, contacts.id);
}

export type ContactListItem = Awaited<ReturnType<typeof listContacts>>[number];

export async function countContacts(ownerId: string) {
  const [row] = await getDb()
    .select({ total: count() })
    .from(contacts)
    .where(eq(contacts.ownerId, ownerId));
  return row.total;
}

// Cached per request: the page and its metadata both read the same contact.
// A contact of somebody else is not found, the same as one that does not exist.
export const getContact = cache(async (ownerId: string, id: number) => {
  const [contact] = await getDb()
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.ownerId, ownerId)));
  return contact;
});

export async function listNotes(ownerId: string, contactId: number) {
  const rows = await getDb()
    .select({ note: notes })
    .from(notes)
    .innerJoin(contacts, eq(contacts.id, notes.contactId))
    .where(and(eq(notes.contactId, contactId), eq(contacts.ownerId, ownerId)))
    .orderBy(desc(notes.createdAt), desc(notes.id));
  return rows.map((row) => row.note);
}

// Contacts with a frequency and the date of the last note, in the order of the general list.
// Which of them are overdue is decided by getTermStatus: one set of rules for the block and the card.
export async function listContactsWithTerm(ownerId: string) {
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
    .where(and(eq(contacts.ownerId, ownerId), isNotNull(contacts.keepInTouchFrequency)))
    .groupBy(contacts.id)
    .orderBy(nameOrder, contacts.id);
}

// Same alphabetical rules as the contact list
const groupNameOrder = sql`${groups.name} collate "ru-RU-x-icu"`;

export async function listGroups(ownerId: string) {
  return getDb()
    .select({ id: groups.id, name: groups.name })
    .from(groups)
    .where(eq(groups.ownerId, ownerId))
    .orderBy(groupNameOrder, groups.id);
}

// The groups of a contact of this owner; for the contact of somebody else the list is empty
export async function listContactGroups(ownerId: string, contactId: number) {
  return getDb()
    .select({ id: groups.id, name: groups.name })
    .from(contactGroups)
    .innerJoin(groups, eq(groups.id, contactGroups.groupId))
    .innerJoin(contacts, eq(contacts.id, contactGroups.contactId))
    .where(
      and(
        eq(contactGroups.contactId, contactId),
        eq(contacts.ownerId, ownerId),
        eq(groups.ownerId, ownerId),
      ),
    )
    .orderBy(groupNameOrder, groups.id);
}

export async function listGroupsWithCounts(ownerId: string) {
  return getDb()
    .select({
      id: groups.id,
      name: groups.name,
      contactCount: count(contacts.id),
    })
    .from(groups)
    .leftJoin(contactGroups, eq(contactGroups.groupId, groups.id))
    .leftJoin(
      contacts,
      and(eq(contacts.id, contactGroups.contactId), eq(contacts.ownerId, ownerId)),
    )
    .where(eq(groups.ownerId, ownerId))
    .groupBy(groups.id)
    .orderBy(groupNameOrder, groups.id);
}
