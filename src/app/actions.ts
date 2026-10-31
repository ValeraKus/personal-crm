"use server";

import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";

import { getDb } from "@/db";
import { dbErrorForLog } from "@/db/errors";
import { contactGroups, contacts, groups, notes } from "@/db/schema";
import { parseContactId, parseGroupIds } from "@/lib/ids";
import { CONTACTED_NOTE } from "@/lib/keep-in-touch";
import {
  contactSchema,
  foldGroupName,
  groupNameSchema,
  noteSchema,
  type ContactField,
} from "@/lib/validation";

export type ContactFormState = {
  fieldErrors?: Partial<Record<ContactField, string>>;
  groupsError?: string;
  formError?: string;
};

export type NoteFormState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "saved"; savedAt: number };

export type MarkContactedResult =
  | { status: "marked"; noteId: number; name: string }
  | { status: "error"; message: string };

export type UndoMarkContactedResult =
  { status: "undone" } | { status: "error"; message: string };

// How long after the check mark it can be undone (the toast lasts 5 seconds)
const UNDO_WINDOW_SECONDS = 60;

export type DeleteContactState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "deleted" };

const CONTACT_FIELDS: ContactField[] = [
  "name",
  "about",
  "howWeMet",
  "phone",
  "email",
  "keepInTouchFrequency",
  "keepInTouchDays",
];

function readContactForm(formData: FormData) {
  return Object.fromEntries(
    CONTACT_FIELDS.map((field) => [field, String(formData.get(field) ?? "")]),
  );
}

function firstErrorPerField(
  error: z.ZodError,
): ContactFormState["fieldErrors"] {
  const result: Partial<Record<ContactField, string>> = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as ContactField;
    result[field] ??= issue.message;
  }
  return result;
}

type Db = ReturnType<typeof getDb>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

// Group choices from the form: ids of existing groups and names of groups to create on save
function readGroups(formData: FormData) {
  const groupIds = parseGroupIds(formData.getAll("groupIds").map(String));
  const names: string[] = [];
  for (const raw of formData.getAll("newGroups")) {
    const parsed = groupNameSchema.safeParse(String(raw));
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    if (
      !names.some((name) => foldGroupName(name) === foldGroupName(parsed.data))
    ) {
      names.push(parsed.data);
    }
  }
  return { groupIds, names };
}

// Replaces all groups of the contact. New names are created here, in the caller's transaction;
// a name that already exists (any case, "е"/"ё") reuses the existing group. Ids of groups that
// are gone (deleted in another browser) are skipped.
async function replaceContactGroups(
  tx: Tx,
  contactId: number,
  groupIds: number[],
  newNames: string[],
) {
  const ids = new Set<number>();
  if (groupIds.length > 0) {
    const existing = await tx
      .select({ id: groups.id })
      .from(groups)
      .where(inArray(groups.id, groupIds));
    for (const row of existing) ids.add(row.id);
  }
  for (const name of newNames) {
    // The unique index on the folded name decides, so two parallel requests cannot make a duplicate
    await tx.insert(groups).values({ name }).onConflictDoNothing();
    const [group] = await tx
      .select({ id: groups.id })
      .from(groups)
      .where(
        sql`replace(lower(${groups.name}), 'ё', 'е') = ${foldGroupName(name)}`,
      );
    if (group) ids.add(group.id);
  }
  await tx.delete(contactGroups).where(eq(contactGroups.contactId, contactId));
  if (ids.size > 0) {
    await tx
      .insert(contactGroups)
      .values([...ids].map((groupId) => ({ contactId, groupId })));
  }
}

export async function createContact(
  _previousState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const parsed = contactSchema.safeParse(readContactForm(formData));
  if (!parsed.success) {
    return { fieldErrors: firstErrorPerField(parsed.error) };
  }
  const chosen = readGroups(formData);
  if ("error" in chosen) return { groupsError: chosen.error };

  let id: number;
  try {
    // The term counts from now if a frequency is chosen
    const keepInTouchSince = parsed.data.keepInTouchFrequency
      ? new Date()
      : null;
    id = await getDb().transaction(async (tx) => {
      const [created] = await tx
        .insert(contacts)
        .values({ ...parsed.data, keepInTouchSince })
        .returning({ id: contacts.id });
      await replaceContactGroups(tx, created.id, chosen.groupIds, chosen.names);
      return created.id;
    });
  } catch (error) {
    console.error("Failed to create contact", dbErrorForLog(error));
    return { formError: "Не удалось сохранить контакт. Попробуйте ещё раз." };
  }

  revalidatePath("/");
  revalidatePath("/groups");
  redirect(`/?added=${id}`);
}

export async function updateContact(
  rawId: number,
  _previousState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const id = parseContactId(rawId);
  if (id === null) {
    return { formError: "Контакт не найден." };
  }

  const parsed = contactSchema.safeParse(readContactForm(formData));
  if (!parsed.success) {
    return { fieldErrors: firstErrorPerField(parsed.error) };
  }
  const chosen = readGroups(formData);
  if ("error" in chosen) return { groupsError: chosen.error };

  try {
    const found = await getDb().transaction(async (tx) => {
      const updated = await tx
        .update(contacts)
        .set({
          ...parsed.data,
          // One UPDATE compares with the stored values, so saving the form without changing
          // the frequency or the number of days does not move the start of the term
          keepInTouchSince: sql`case
          when ${parsed.data.keepInTouchFrequency}::text is null then null
          when ${contacts.keepInTouchFrequency} is distinct from ${parsed.data.keepInTouchFrequency}::text
            or ${contacts.keepInTouchDays} is distinct from ${parsed.data.keepInTouchDays}::smallint
            then now()
          else ${contacts.keepInTouchSince}
        end`,
          updatedAt: new Date(),
        })
        .where(eq(contacts.id, id))
        .returning({ id: contacts.id });
      if (updated.length === 0) return false;
      await replaceContactGroups(tx, id, chosen.groupIds, chosen.names);
      return true;
    });
    if (!found) {
      return { formError: "Контакт не найден." };
    }
  } catch (error) {
    console.error("Failed to update contact", dbErrorForLog(error));
    return { formError: "Не удалось сохранить изменения. Попробуйте ещё раз." };
  }

  revalidatePath("/");
  revalidatePath("/groups");
  revalidatePath(`/contacts/${id}`);
  redirect(`/contacts/${id}`);
}

export async function addNote(
  rawContactId: number,
  _previousState: NoteFormState,
  formData: FormData,
): Promise<NoteFormState> {
  const contactId = parseContactId(rawContactId);
  if (contactId === null) {
    return { status: "error", message: "Контакт не найден." };
  }

  const parsed = noteSchema.safeParse({
    body: String(formData.get("body") ?? ""),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0].message };
  }

  try {
    const [contact] = await getDb()
      .select({ id: contacts.id })
      .from(contacts)
      .where(eq(contacts.id, contactId));
    if (!contact) {
      return { status: "error", message: "Контакт не найден." };
    }
    await getDb().insert(notes).values({ contactId, body: parsed.data.body });
  } catch (error) {
    console.error("Failed to add note", dbErrorForLog(error));
    return {
      status: "error",
      message: "Не удалось сохранить заметку. Попробуйте ещё раз.",
    };
  }

  revalidatePath(`/contacts/${contactId}`);
  return { status: "saved", savedAt: Date.now() };
}

// Notes go away together with the contact: the foreign key deletes them on cascade.
// No revalidatePath here: it would re-render the current page, the card of the deleted contact,
// as "not found". The client goes to the list itself, and the list always reads fresh data.
export async function deleteContact(
  rawId: number,
): Promise<DeleteContactState> {
  const id = parseContactId(rawId);
  if (id === null) {
    return { status: "error", message: "Контакт не найден." };
  }

  try {
    // Nothing deleted means it is already gone, e.g. deleted in another browser: same result
    await getDb().delete(contacts).where(eq(contacts.id, id));
  } catch (error) {
    console.error("Failed to delete contact", dbErrorForLog(error));
    return {
      status: "error",
      message: "Не удалось удалить контакт. Попробуйте ещё раз.",
    };
  }

  return { status: "deleted" };
}

// The "contacted" check mark is an ordinary note, so the term counts from it like from any note
export async function markContacted(
  rawContactId: number,
): Promise<MarkContactedResult> {
  const contactId = parseContactId(rawContactId);
  if (contactId === null) {
    return { status: "error", message: "Контакт не найден." };
  }

  let result: { noteId: number; name: string };
  try {
    const [contact] = await getDb()
      .select({ name: contacts.name })
      .from(contacts)
      .where(eq(contacts.id, contactId));
    if (!contact) {
      return { status: "error", message: "Контакт не найден." };
    }
    const [note] = await getDb()
      .insert(notes)
      .values({ contactId, body: CONTACTED_NOTE })
      .returning({ id: notes.id });
    result = { noteId: note.id, name: contact.name };
  } catch (error) {
    console.error("Failed to mark contact as contacted", dbErrorForLog(error));
    return { status: "error", message: "Не удалось отметить" };
  }

  revalidatePath("/");
  revalidatePath(`/contacts/${contactId}`);
  return { status: "marked", ...result };
}

// Deletes only a fresh "contacted" note: the text and the age are checked here, on the server,
// so any other note stays untouched even if this is called with its id
export async function undoMarkContacted(
  rawNoteId: number,
): Promise<UndoMarkContactedResult> {
  const noteId = parseContactId(rawNoteId);
  if (noteId === null) {
    return { status: "error", message: "Не удалось отменить" };
  }

  let contactId: number | undefined;
  try {
    const [deleted] = await getDb()
      .delete(notes)
      .where(
        and(
          eq(notes.id, noteId),
          eq(notes.body, CONTACTED_NOTE),
          gt(
            notes.createdAt,
            sql`now() - make_interval(secs => ${UNDO_WINDOW_SECONDS})`,
          ),
        ),
      )
      .returning({ contactId: notes.contactId });
    contactId = deleted?.contactId;
  } catch (error) {
    console.error("Failed to undo contacted mark", dbErrorForLog(error));
    return { status: "error", message: "Не удалось отменить" };
  }

  if (contactId === undefined) {
    return { status: "error", message: "Не удалось отменить" };
  }

  revalidatePath("/");
  revalidatePath(`/contacts/${contactId}`);
  return { status: "undone" };
}

export type RenameGroupState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "renamed"; savedAt: number };

export type DeleteGroupState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "deleted" };

export async function renameGroup(
  rawId: number,
  _previousState: RenameGroupState,
  formData: FormData,
): Promise<RenameGroupState> {
  const id = parseContactId(rawId);
  if (id === null) {
    return { status: "error", message: "Группа не найдена." };
  }

  const parsed = groupNameSchema.safeParse(String(formData.get("name") ?? ""));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0].message };
  }

  try {
    // Renaming a group to its own name in another case ("теннис" -> "Теннис") is allowed:
    // the unique index ignores the row being updated
    const updated = await getDb()
      .update(groups)
      .set({ name: parsed.data })
      .where(eq(groups.id, id))
      .returning({ id: groups.id });
    if (updated.length === 0) {
      return { status: "error", message: "Группа не найдена." };
    }
  } catch (error) {
    // 23505: the unique index on the folded name, so the title is taken by another group
    if (
      error instanceof Error &&
      (error.cause as { code?: string } | undefined)?.code === "23505"
    ) {
      return { status: "error", message: "Группа с таким названием уже есть" };
    }
    console.error("Failed to rename group", dbErrorForLog(error));
    return {
      status: "error",
      message: "Не удалось переименовать группу. Попробуйте ещё раз.",
    };
  }

  revalidatePath("/");
  revalidatePath("/groups");
  return { status: "renamed", savedAt: Date.now() };
}

// Only the links between the group and its contacts go away: the foreign key deletes them on cascade
export async function deleteGroup(rawId: number): Promise<DeleteGroupState> {
  const id = parseContactId(rawId);
  if (id === null) {
    return { status: "error", message: "Группа не найдена." };
  }

  try {
    // Nothing deleted means it is already gone, e.g. deleted in another browser: same result
    await getDb().delete(groups).where(eq(groups.id, id));
  } catch (error) {
    console.error("Failed to delete group", dbErrorForLog(error));
    return {
      status: "error",
      message: "Не удалось удалить группу. Попробуйте ещё раз.",
    };
  }

  revalidatePath("/");
  revalidatePath("/groups");
  return { status: "deleted" };
}
