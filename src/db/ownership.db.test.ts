// The data layer must never show or change what belongs to somebody else. Two users, A and B, each
// with contacts, notes and groups; B asks for A's data in every way the layer allows.
// Scenarios of openspec/specs/data-ownership/spec.md and the new scenarios of
// contact-groups, on the real database. A browser cannot send a request with a number of somebody
// else's record (the actions are called by an internal number), so these tests are where
// «Запрос к серверу с номером чужого контакта / группы» and «Отмена чужой отметки» are checked.

import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import type { ContactInput } from "@/lib/validation";
import { CONTACTED_NOTE } from "@/lib/keep-in-touch";

import { resetData } from "../../test-db/reset";
import { getDb } from "./index";
import {
  addNote,
  createContact,
  deleteContact,
  deleteGroup,
  markContacted,
  renameGroup,
  undoMarkContacted,
  updateContact,
} from "./mutations";
import {
  countContacts,
  getContact,
  listContactGroups,
  listContacts,
  listContactsWithTerm,
  listGroups,
  listGroupsWithCounts,
  listNotes,
} from "./queries";
import { contactGroups, contacts, groups, notes, users } from "./schema";

const NO_GROUPS = { groupIds: [], newNames: [] };

function input(name: string, overrides: Partial<ContactInput> = {}): ContactInput {
  return {
    name,
    about: null,
    howWeMet: null,
    phone: null,
    email: null,
    keepInTouchFrequency: null,
    keepInTouchDays: null,
    ...overrides,
  };
}

type World = {
  a: string;
  b: string;
  contactA: number;
  contactB: number;
  noteA: number;
  groupA: number;
  groupB: number;
};

// A: contact «Анна» with a note, in the group «Теннис»; weekly term started long ago (overdue).
// B: contact «Борис» in the group «Шахматы».
async function setUp(): Promise<World> {
  const db = getDb();
  await resetData();
  await db.insert(users).values([
    { id: "user-a", name: "", email: "a@example.com" },
    { id: "user-b", name: "", email: "b@example.com" },
  ]);

  const [groupA] = await db
    .insert(groups)
    .values({ ownerId: "user-a", name: "Теннис" })
    .returning();
  const [groupB] = await db
    .insert(groups)
    .values({ ownerId: "user-b", name: "Шахматы" })
    .returning();
  const [contactA] = await db
    .insert(contacts)
    .values({
      ownerId: "user-a",
      name: "Анна",
      keepInTouchFrequency: "week",
      keepInTouchSince: new Date("2026-01-01T12:00:00Z"),
    })
    .returning();
  const [contactB] = await db
    .insert(contacts)
    .values({ ownerId: "user-b", name: "Борис" })
    .returning();
  const [noteA] = await db
    .insert(notes)
    .values({ contactId: contactA.id, body: "Созвонились" })
    .returning();
  await db.insert(contactGroups).values([
    { contactId: contactA.id, groupId: groupA.id },
    { contactId: contactB.id, groupId: groupB.id },
  ]);
  return {
    a: "user-a",
    b: "user-b",
    contactA: contactA.id,
    contactB: contactB.id,
    noteA: noteA.id,
    groupA: groupA.id,
    groupB: groupB.id,
  };
}

let w: World;
beforeEach(async () => {
  w = await setUp();
});

async function rowsOf<T>(rows: Promise<T[]>) {
  return rows;
}

describe("reads show only the data of their owner", () => {
  it("listContacts: the list and the search", async () => {
    expect((await listContacts(w.a)).map((c) => c.name)).toEqual(["Анна"]);
    expect((await listContacts(w.b)).map((c) => c.name)).toEqual(["Борис"]);
    expect(await listContacts(w.b, "Анна")).toEqual([]);
    expect(await listContacts(w.b, "", [w.groupA])).toEqual([]);
  });

  it("countContacts: the counter", async () => {
    expect(await countContacts(w.a)).toBe(1);
    expect(await countContacts(w.b)).toBe(1);
    await getDb().insert(contacts).values({ ownerId: w.a, name: "Ещё один" });
    expect(await countContacts(w.a)).toBe(2);
    expect(await countContacts(w.b)).toBe(1);
  });

  it("getContact: a card of somebody else's contact is not found, like a missing one", async () => {
    expect((await getContact(w.a, w.contactA))?.name).toBe("Анна");
    expect(await getContact(w.b, w.contactA)).toBeUndefined();
    expect(await getContact(w.b, 999_999)).toBeUndefined();
  });

  it("listNotes: the notes of somebody else's contact", async () => {
    expect((await listNotes(w.a, w.contactA)).map((n) => n.body)).toEqual(["Созвонились"]);
    expect(await listNotes(w.b, w.contactA)).toEqual([]);
  });

  it("listContactsWithTerm: the overdue contacts of somebody else", async () => {
    expect((await listContactsWithTerm(w.a)).map((c) => c.name)).toEqual(["Анна"]);
    expect(await listContactsWithTerm(w.b)).toEqual([]);
  });

  it("listGroups: the groups", async () => {
    expect((await listGroups(w.a)).map((g) => g.name)).toEqual(["Теннис"]);
    expect((await listGroups(w.b)).map((g) => g.name)).toEqual(["Шахматы"]);
  });

  it("listContactGroups: the groups of somebody else's contact", async () => {
    expect((await listContactGroups(w.a, w.contactA)).map((g) => g.name)).toEqual(["Теннис"]);
    expect(await listContactGroups(w.b, w.contactA)).toEqual([]);
  });

  it("listGroupsWithCounts: the groups page", async () => {
    expect(await listGroupsWithCounts(w.a)).toEqual([
      { id: w.groupA, name: "Теннис", contactCount: 1 },
    ]);
    expect(await listGroupsWithCounts(w.b)).toEqual([
      { id: w.groupB, name: "Шахматы", contactCount: 1 },
    ]);
  });
});

describe("writes with a number of somebody else's record change nothing", () => {
  it("updateContact: somebody else's contact is not found and stays as it was", async () => {
    const found = await updateContact(w.b, w.contactA, input("Взломана"), NO_GROUPS);

    expect(found).toBe(false);
    expect((await getContact(w.a, w.contactA))?.name).toBe("Анна");
  });

  it("deleteContact: somebody else's contact and its notes stay", async () => {
    await deleteContact(w.b, w.contactA);

    expect(await getContact(w.a, w.contactA)).toBeDefined();
    expect(await listNotes(w.a, w.contactA)).toHaveLength(1);
  });

  it("addNote: no note under somebody else's contact", async () => {
    expect(await addNote(w.b, w.contactA, "Чужая заметка")).toBe(false);
    expect(await listNotes(w.a, w.contactA)).toHaveLength(1);
    expect(await addNote(w.a, w.contactA, "Своя заметка")).toBe(true);
    expect(await listNotes(w.a, w.contactA)).toHaveLength(2);
  });

  it("markContacted: no «Пообщались» note for somebody else's contact", async () => {
    expect(await markContacted(w.b, w.contactA)).toBeNull();
    expect(await listNotes(w.a, w.contactA)).toHaveLength(1);

    const marked = await markContacted(w.a, w.contactA);
    expect(marked).toMatchObject({ name: "Анна" });
  });

  it("undoMarkContacted: somebody else's note stays, one's own is removed", async () => {
    const marked = await markContacted(w.a, w.contactA);
    if (!marked) throw new Error("the contact of A must be marked");

    expect(await undoMarkContacted(w.b, marked.noteId, 60)).toBeNull();
    expect((await listNotes(w.a, w.contactA)).map((n) => n.body)).toContain(CONTACTED_NOTE);

    expect(await undoMarkContacted(w.a, marked.noteId, 60)).toBe(w.contactA);
    expect((await listNotes(w.a, w.contactA)).map((n) => n.body)).not.toContain(CONTACTED_NOTE);
  });

  it("undoMarkContacted: only a «Пообщались» note, and only a fresh one", async () => {
    // A usual note of the owner is not removed even by the owner
    expect(await undoMarkContacted(w.a, w.noteA, 60)).toBeNull();
    expect(await listNotes(w.a, w.contactA)).toHaveLength(1);
  });

  it("renameGroup: somebody else's group is not found and keeps its name", async () => {
    expect(await renameGroup(w.b, w.groupA, "Взломана")).toBe("not-found");
    expect((await listGroups(w.a)).map((g) => g.name)).toEqual(["Теннис"]);
  });

  it("deleteGroup: somebody else's group and its links stay", async () => {
    await deleteGroup(w.b, w.groupA);

    expect(await listGroups(w.a)).toHaveLength(1);
    expect(await listContactGroups(w.a, w.contactA)).toHaveLength(1);
  });

  it("createContact: a mark with somebody else's group does not put the contact there", async () => {
    const id = await createContact(w.b, input("Новый Б"), { groupIds: [w.groupA], newNames: [] });

    expect(await listContactGroups(w.b, id)).toEqual([]);
    expect(
      await getDb().select().from(contactGroups).where(eq(contactGroups.groupId, w.groupA)),
    ).toHaveLength(1);
  });

  it("updateContact: the same, on saving one's own contact", async () => {
    const found = await updateContact(w.b, w.contactB, input("Борис"), {
      groupIds: [w.groupA, w.groupB],
      newNames: [],
    });

    expect(found).toBe(true);
    expect((await listContactGroups(w.b, w.contactB)).map((g) => g.name)).toEqual(["Шахматы"]);
    expect((await listContactGroups(w.a, w.contactA)).map((g) => g.name)).toEqual(["Теннис"]);
  });
});

describe("a user's own data", () => {
  it("createContact: the contact is the owner's, with the start of the term when there is a frequency", async () => {
    const id = await createContact(
      w.a,
      input("Вера", { keepInTouchFrequency: "month" }),
      NO_GROUPS,
    );

    const contact = await getContact(w.a, id);
    expect(contact).toMatchObject({ name: "Вера", ownerId: w.a });
    expect(contact?.keepInTouchSince).toBeInstanceOf(Date);
    expect(await getContact(w.b, id)).toBeUndefined();
  });

  it("updateContact: changes the contact; saving without changing the frequency keeps the start of the term", async () => {
    const before = (await getContact(w.a, w.contactA))!;

    const found = await updateContact(
      w.a,
      w.contactA,
      input("Анна Новая", { keepInTouchFrequency: "week" }),
      NO_GROUPS,
    );

    const after = (await getContact(w.a, w.contactA))!;
    expect(found).toBe(true);
    expect(after.name).toBe("Анна Новая");
    expect(after.keepInTouchSince).toEqual(before.keepInTouchSince);
  });

  it("deleteContact: removes the contact with its notes", async () => {
    await deleteContact(w.a, w.contactA);

    expect(await getContact(w.a, w.contactA)).toBeUndefined();
    expect(await getDb().select().from(notes)).toHaveLength(0);
  });

  it("renameGroup: renames, reports a taken name, allows another case of its own name", async () => {
    await getDb().insert(groups).values({ ownerId: w.a, name: "Книги" });

    expect(await renameGroup(w.a, w.groupA, "Шахматы")).toBe("renamed");
    expect(await renameGroup(w.a, w.groupA, "книги")).toBe("duplicate");
    expect(await renameGroup(w.a, w.groupA, "шахматы")).toBe("renamed");
    expect((await listGroups(w.a)).map((g) => g.name)).toEqual(["Книги", "шахматы"]);
  });
});

describe("groups with the same name for different users (contact-groups)", () => {
  it("each user has a group of his own with the name", async () => {
    const idA = await createContact(w.a, input("Контакт А"), {
      groupIds: [],
      newNames: ["Друзья"],
    });
    const idB = await createContact(w.b, input("Контакт Б"), {
      groupIds: [],
      newNames: ["Друзья"],
    });

    const friendsA = (await listContactGroups(w.a, idA))[0];
    const friendsB = (await listContactGroups(w.b, idB))[0];
    expect(friendsA.name).toBe("Друзья");
    expect(friendsB.name).toBe("Друзья");
    expect(friendsA.id).not.toBe(friendsB.id);
    expect(
      await rowsOf(getDb().select().from(groups).where(eq(groups.name, "Друзья"))),
    ).toHaveLength(2);
  });

  it("a name that the user already has marks his existing group, in any case and with «е» for «ё»", async () => {
    await createContact(w.a, input("Первый"), { groupIds: [], newNames: ["Тётя"] });
    const second = await createContact(w.a, input("Второй"), { groupIds: [], newNames: ["тетя"] });

    const own = (await listGroups(w.a)).filter((g) => g.name === "Тётя");
    expect(own).toHaveLength(1);
    expect((await listContactGroups(w.a, second)).map((g) => g.id)).toEqual([own[0].id]);
  });

  it("renaming into the name of somebody else's group works and leaves that group as it was", async () => {
    expect(await renameGroup(w.b, w.groupB, "Теннис")).toBe("renamed");

    expect((await listGroups(w.b)).map((g) => g.name)).toEqual(["Теннис"]);
    expect((await listGroups(w.a)).map((g) => g.name)).toEqual(["Теннис"]);
    expect((await listGroups(w.a))[0].id).toBe(w.groupA);
  });
});
