"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";

import { dbErrorForLog } from "@/db/errors";
import * as db from "@/db/mutations";
import { parseContactId, parseGroupIds } from "@/lib/ids";
import { requireUser } from "@/lib/session";
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
  { status: "idle" } | { status: "error"; message: string } | { status: "saved"; savedAt: number };

export type MarkContactedResult =
  { status: "marked"; noteId: number; name: string } | { status: "error"; message: string };

export type UndoMarkContactedResult = { status: "undone" } | { status: "error"; message: string };

// How long after the check mark it can be undone (the toast lasts 5 seconds)
const UNDO_WINDOW_SECONDS = 60;

export type DeleteContactState =
  { status: "idle" } | { status: "error"; message: string } | { status: "deleted" };

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

function firstErrorPerField(error: z.ZodError): ContactFormState["fieldErrors"] {
  const result: Partial<Record<ContactField, string>> = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as ContactField;
    result[field] ??= issue.message;
  }
  return result;
}

// Group choices from the form: numbers of existing groups and names of groups to create on save
function readGroups(formData: FormData) {
  const groupIds = parseGroupIds(formData.getAll("groupIds").map(String));
  const newNames: string[] = [];
  for (const raw of formData.getAll("newGroups")) {
    const parsed = groupNameSchema.safeParse(String(raw));
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    if (!newNames.some((name) => foldGroupName(name) === foldGroupName(parsed.data))) {
      newNames.push(parsed.data);
    }
  }
  return { groupIds, newNames };
}

// Every action starts with requireUser(): the owner of the data comes from the session and
// nowhere else. A record of somebody else is answered like one that does not exist (see db/mutations).

export async function createContact(
  _previousState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const user = await requireUser();
  const parsed = contactSchema.safeParse(readContactForm(formData));
  if (!parsed.success) {
    return { fieldErrors: firstErrorPerField(parsed.error) };
  }
  const chosen = readGroups(formData);
  if ("error" in chosen) return { groupsError: chosen.error };

  let id: number;
  try {
    id = await db.createContact(user.id, parsed.data, chosen);
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
  const user = await requireUser();
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
    const found = await db.updateContact(user.id, id, parsed.data, chosen);
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
  const user = await requireUser();
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
    if (!(await db.addNote(user.id, contactId, parsed.data.body))) {
      return { status: "error", message: "Контакт не найден." };
    }
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
export async function deleteContact(rawId: number): Promise<DeleteContactState> {
  const user = await requireUser();
  const id = parseContactId(rawId);
  if (id === null) {
    return { status: "error", message: "Контакт не найден." };
  }

  try {
    // Nothing deleted means it is already gone (e.g. deleted in another browser) or not the
    // user's: the same result
    await db.deleteContact(user.id, id);
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
export async function markContacted(rawContactId: number): Promise<MarkContactedResult> {
  const user = await requireUser();
  const contactId = parseContactId(rawContactId);
  if (contactId === null) {
    return { status: "error", message: "Контакт не найден." };
  }

  let result: { noteId: number; name: string } | null;
  try {
    result = await db.markContacted(user.id, contactId);
  } catch (error) {
    console.error("Failed to mark contact as contacted", dbErrorForLog(error));
    return { status: "error", message: "Не удалось отметить" };
  }
  if (!result) {
    return { status: "error", message: "Контакт не найден." };
  }

  revalidatePath("/");
  revalidatePath(`/contacts/${contactId}`);
  return { status: "marked", ...result };
}

// Deletes only a fresh "contacted" note: the text, the age and the owner are checked in the
// database layer, so any other note stays untouched even if this is called with its id
export async function undoMarkContacted(rawNoteId: number): Promise<UndoMarkContactedResult> {
  const user = await requireUser();
  const noteId = parseContactId(rawNoteId);
  if (noteId === null) {
    return { status: "error", message: "Не удалось отменить" };
  }

  let contactId: number | null;
  try {
    contactId = await db.undoMarkContacted(user.id, noteId, UNDO_WINDOW_SECONDS);
  } catch (error) {
    console.error("Failed to undo contacted mark", dbErrorForLog(error));
    return { status: "error", message: "Не удалось отменить" };
  }

  if (contactId === null) {
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
  { status: "idle" } | { status: "error"; message: string } | { status: "deleted" };

export async function renameGroup(
  rawId: number,
  _previousState: RenameGroupState,
  formData: FormData,
): Promise<RenameGroupState> {
  const user = await requireUser();
  const id = parseContactId(rawId);
  if (id === null) {
    return { status: "error", message: "Группа не найдена." };
  }

  const parsed = groupNameSchema.safeParse(String(formData.get("name") ?? ""));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0].message };
  }

  try {
    const result = await db.renameGroup(user.id, id, parsed.data);
    if (result === "not-found") {
      return { status: "error", message: "Группа не найдена." };
    }
    if (result === "duplicate") {
      return { status: "error", message: "Группа с таким названием уже есть" };
    }
  } catch (error) {
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
  const user = await requireUser();
  const id = parseContactId(rawId);
  if (id === null) {
    return { status: "error", message: "Группа не найдена." };
  }

  try {
    // Nothing deleted means it is already gone or not the user's: the same result
    await db.deleteGroup(user.id, id);
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
