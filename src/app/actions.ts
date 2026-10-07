"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";

import { db } from "@/db";
import { contacts, notes } from "@/db/schema";
import { parseContactId } from "@/lib/ids";
import { contactSchema, noteSchema, type ContactField } from "@/lib/validation";

export type ContactFormState = {
  fieldErrors?: Partial<Record<ContactField, string>>;
  formError?: string;
};

export type NoteFormState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "saved"; savedAt: number };

const CONTACT_FIELDS: ContactField[] = ["name", "about", "howWeMet", "phone", "email"];

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

export async function createContact(
  _previousState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const parsed = contactSchema.safeParse(readContactForm(formData));
  if (!parsed.success) {
    return { fieldErrors: firstErrorPerField(parsed.error) };
  }

  let id: number;
  try {
    [{ id }] = await db.insert(contacts).values(parsed.data).returning({ id: contacts.id });
  } catch (error) {
    console.error("Failed to create contact", error);
    return { formError: "Не удалось сохранить контакт. Попробуйте ещё раз." };
  }

  revalidatePath("/");
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

  try {
    const updated = await db
      .update(contacts)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(contacts.id, id))
      .returning({ id: contacts.id });
    if (updated.length === 0) {
      return { formError: "Контакт не найден." };
    }
  } catch (error) {
    console.error("Failed to update contact", error);
    return { formError: "Не удалось сохранить изменения. Попробуйте ещё раз." };
  }

  revalidatePath("/");
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

  const parsed = noteSchema.safeParse({ body: String(formData.get("body") ?? "") });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0].message };
  }

  try {
    const [contact] = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(eq(contacts.id, contactId));
    if (!contact) {
      return { status: "error", message: "Контакт не найден." };
    }
    await db.insert(notes).values({ contactId, body: parsed.data.body });
  } catch (error) {
    console.error("Failed to add note", error);
    return { status: "error", message: "Не удалось сохранить заметку. Попробуйте ещё раз." };
  }

  revalidatePath(`/contacts/${contactId}`);
  return { status: "saved", savedAt: Date.now() };
}
