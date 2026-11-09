import "server-only";

import { and, eq, gt, inArray, sql } from "drizzle-orm";

import { CONTACTED_NOTE } from "@/lib/keep-in-touch";
import { foldGroupName, type ContactInput } from "@/lib/validation";

import { getDb } from "./index";
import { contactGroups, contacts, groups, notes } from "./schema";

// Every write here takes the owner as the first argument and touches only his records. A record of
// somebody else is treated as one that does not exist: nothing is changed and the answer is the
// same as for a missing number. The owner always comes from the session (requireUser), never from
// a form or an address.

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

// Groups chosen in the contact form: numbers of existing groups and names to create on save
export type GroupChoice = { groupIds: number[]; newNames: string[] };

// Replaces all groups of the contact (which must be the owner's). Numbers of groups of somebody
// else and of groups that are gone (deleted in another browser) are skipped. New names are created
// here, in the caller's transaction, as groups of the owner; a name he already has (any case,
// "е"/"ё") marks his existing group.
async function replaceContactGroups(
  tx: Tx,
  ownerId: string,
  contactId: number,
  choice: GroupChoice,
) {
  const ids = new Set<number>();
  if (choice.groupIds.length > 0) {
    const own = await tx
      .select({ id: groups.id })
      .from(groups)
      .where(and(inArray(groups.id, choice.groupIds), eq(groups.ownerId, ownerId)));
    for (const row of own) ids.add(row.id);
  }
  for (const name of choice.newNames) {
    // The unique index on the owner and the folded name decides, so two parallel requests cannot
    // make a duplicate
    await tx.insert(groups).values({ ownerId, name }).onConflictDoNothing();
    const [group] = await tx
      .select({ id: groups.id })
      .from(groups)
      .where(
        and(
          eq(groups.ownerId, ownerId),
          sql`replace(lower(${groups.name}), 'ё', 'е') = ${foldGroupName(name)}`,
        ),
      );
    if (group) ids.add(group.id);
  }
  await tx.delete(contactGroups).where(eq(contactGroups.contactId, contactId));
  if (ids.size > 0) {
    await tx.insert(contactGroups).values([...ids].map((groupId) => ({ contactId, groupId })));
  }
}

// Returns the number of the new contact
export async function createContact(ownerId: string, data: ContactInput, choice: GroupChoice) {
  // The term counts from now if a frequency is chosen
  const keepInTouchSince = data.keepInTouchFrequency ? new Date() : null;
  return getDb().transaction(async (tx) => {
    const [created] = await tx
      .insert(contacts)
      .values({ ...data, ownerId, keepInTouchSince })
      .returning({ id: contacts.id });
    await replaceContactGroups(tx, ownerId, created.id, choice);
    return created.id;
  });
}

// False when the contact is not the owner's or does not exist
export async function updateContact(
  ownerId: string,
  id: number,
  data: ContactInput,
  choice: GroupChoice,
) {
  return getDb().transaction(async (tx) => {
    const updated = await tx
      .update(contacts)
      .set({
        ...data,
        // One UPDATE compares with the stored values, so saving the form without changing
        // the frequency or the number of days does not move the start of the term
        keepInTouchSince: sql`case
          when ${data.keepInTouchFrequency}::text is null then null
          when ${contacts.keepInTouchFrequency} is distinct from ${data.keepInTouchFrequency}::text
            or ${contacts.keepInTouchDays} is distinct from ${data.keepInTouchDays}::smallint
            then now()
          else ${contacts.keepInTouchSince}
        end`,
        updatedAt: new Date(),
      })
      .where(and(eq(contacts.id, id), eq(contacts.ownerId, ownerId)))
      .returning({ id: contacts.id });
    if (updated.length === 0) return false;
    await replaceContactGroups(tx, ownerId, id, choice);
    return true;
  });
}

// The notes go away together with the contact: the foreign key deletes them on cascade.
// Nothing deleted means it is already gone or not the owner's: the same, no error.
export async function deleteContact(ownerId: string, id: number) {
  await getDb()
    .delete(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.ownerId, ownerId)));
}

// False when the contact is not the owner's or does not exist
export async function addNote(ownerId: string, contactId: number, body: string) {
  const [contact] = await getDb()
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.ownerId, ownerId)));
  if (!contact) return false;
  await getDb().insert(notes).values({ contactId, body });
  return true;
}

// The «contacted» check mark is an ordinary note, so the term counts from it like from any note.
// null when the contact is not the owner's or does not exist.
export async function markContacted(ownerId: string, contactId: number) {
  const [contact] = await getDb()
    .select({ name: contacts.name })
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.ownerId, ownerId)));
  if (!contact) return null;
  const [note] = await getDb()
    .insert(notes)
    .values({ contactId, body: CONTACTED_NOTE })
    .returning({ id: notes.id });
  return { noteId: note.id, name: contact.name };
}

// Deletes only a fresh «contacted» note of a contact of the owner: the text and the age are checked
// here, so any other note stays untouched even if this is called with its number.
// Returns the number of its contact, or null when nothing was deleted.
export async function undoMarkContacted(ownerId: string, noteId: number, windowSeconds: number) {
  const [deleted] = await getDb()
    .delete(notes)
    .where(
      and(
        eq(notes.id, noteId),
        eq(notes.body, CONTACTED_NOTE),
        gt(notes.createdAt, sql`now() - make_interval(secs => ${windowSeconds})`),
        sql`exists (
          select 1 from ${contacts}
          where ${contacts.id} = ${notes.contactId} and ${contacts.ownerId} = ${ownerId}
        )`,
      ),
    )
    .returning({ contactId: notes.contactId });
  return deleted?.contactId ?? null;
}

export type RenameGroupResult = "renamed" | "not-found" | "duplicate";

export async function renameGroup(
  ownerId: string,
  id: number,
  name: string,
): Promise<RenameGroupResult> {
  try {
    // Renaming a group to its own name in another case ("теннис" -> "Теннис") is allowed:
    // the unique index ignores the row being updated
    const updated = await getDb()
      .update(groups)
      .set({ name })
      .where(and(eq(groups.id, id), eq(groups.ownerId, ownerId)))
      .returning({ id: groups.id });
    return updated.length === 0 ? "not-found" : "renamed";
  } catch (error) {
    // 23505: the unique index on the owner and the folded name, so the owner has such a group
    if (
      error instanceof Error &&
      (error.cause as { code?: string } | undefined)?.code === "23505"
    ) {
      return "duplicate";
    }
    throw error;
  }
}

// Only the links between the group and its contacts go away: the foreign key deletes them on cascade.
// Nothing deleted means it is already gone or not the owner's: the same, no error.
export async function deleteGroup(ownerId: string, id: number) {
  await getDb()
    .delete(groups)
    .where(and(eq(groups.id, id), eq(groups.ownerId, ownerId)));
}
