// The parts of the contact list on the real database: which contacts are on a page, how many are
// found, and where a contact stands in the list. Scenarios of the requirements "По 100 контактов
// на странице", "Страницы в поиске и фильтре по группам" and "Страница нового контакта" in
// openspec/changes/paging/specs/contact-list-paging/spec.md. The addresses and the switcher are
// checked in the browser tests (e2e/contact-list-paging.spec.ts).

import { beforeEach, describe, expect, it } from "vitest";

import { resetData } from "../../test-db/reset";
import { getDb } from "./index";
import { contactListPosition, countContacts, listContacts } from "./queries";
import { contactGroups, contacts, groups, users } from "./schema";

const OWNER = "user-owner";
const PAGE_SIZE = 100;

async function insertContacts(names: string[], ownerId = OWNER) {
  const rows = await getDb()
    .insert(contacts)
    .values(names.map((name) => ({ ownerId, name })))
    .returning({ id: contacts.id, name: contacts.name });
  return rows;
}

// "Контакт 001" … "Контакт 250": sorted by the number, in the order of the list
function numberedNames(total: number) {
  return Array.from(
    { length: total },
    (_, index) => `Контакт ${String(index + 1).padStart(3, "0")}`,
  );
}

function names(items: { name: string }[]) {
  return items.map((item) => item.name);
}

beforeEach(async () => {
  await resetData();
  await getDb()
    .insert(users)
    .values([
      { id: OWNER, name: "", email: "owner@example.com" },
      { id: "user-other", name: "", email: "other@example.com" },
    ]);
});

describe("listContacts: a part of the list", () => {
  it("returns the second page of 250 contacts: from the 101st to the 200th", async () => {
    const all = numberedNames(250);
    await insertContacts([...all].reverse());

    const page = await listContacts(OWNER, "", [], { offset: PAGE_SIZE, limit: PAGE_SIZE });

    expect(names(page)).toEqual(all.slice(100, 200));
  });

  it("returns the last page with what is left", async () => {
    const all = numberedNames(250);
    await insertContacts(all);

    const page = await listContacts(OWNER, "", [], { offset: 2 * PAGE_SIZE, limit: PAGE_SIZE });

    expect(names(page)).toEqual(all.slice(200));
  });

  it("returns two pages in a row for the open range", async () => {
    const all = numberedNames(250);
    await insertContacts(all);

    const range = await listContacts(OWNER, "", [], { offset: 0, limit: 2 * PAGE_SIZE });

    expect(names(range)).toEqual(all.slice(0, 200));
  });

  it("returns nothing for a page past the end", async () => {
    await insertContacts(numberedNames(10));

    const page = await listContacts(OWNER, "", [], { offset: PAGE_SIZE, limit: PAGE_SIZE });

    expect(page).toEqual([]);
  });

  it("still returns the whole list without a part", async () => {
    await insertContacts(numberedNames(120));

    expect(await listContacts(OWNER)).toHaveLength(120);
  });

  it("puts «ё» next to «е» and equal names in the order of their ids, page after page", async () => {
    // Pages of two contacts cut the list in the middle of the equal names and of «е» / «ё»
    const inserted = await insertContacts([
      "Фёдор",
      "Иван",
      "Ёлкин",
      "Елена",
      "Иван",
      "Евгений",
      "Иван",
      "Алла",
    ]);
    const whole = await listContacts(OWNER);

    const pieces = [];
    for (let offset = 0; offset < inserted.length; offset += 2) {
      pieces.push(...(await listContacts(OWNER, "", [], { offset, limit: 2 })));
    }

    // The same contacts in the same order, none twice and none lost
    expect(pieces.map((item) => item.id)).toEqual(whole.map((item) => item.id));
    expect(names(whole)).toEqual([
      "Алла",
      "Евгений",
      "Елена",
      "Ёлкин",
      "Иван",
      "Иван",
      "Иван",
      "Фёдор",
    ]);
    const ivanIds = whole.filter((item) => item.name === "Иван").map((item) => item.id);
    expect(ivanIds).toEqual([...ivanIds].sort((a, b) => a - b));
  });

  it("takes the part from the found contacts when there is a search", async () => {
    // 150 names with "ов" among 300
    const found = Array.from({ length: 150 }, (_, i) => `Иванов ${String(i + 1).padStart(3, "0")}`);
    const rest = Array.from({ length: 150 }, (_, i) => `Сидор ${String(i + 1).padStart(3, "0")}`);
    await insertContacts([...rest, ...found]);

    const second = await listContacts(OWNER, "ов", [], { offset: PAGE_SIZE, limit: PAGE_SIZE });

    expect(names(second)).toEqual(found.slice(100));
  });

  it("takes the part from the contacts of the chosen groups", async () => {
    const inserted = await insertContacts(numberedNames(150));
    const [group] = await getDb()
      .insert(groups)
      .values({ ownerId: OWNER, name: "Теннис" })
      .returning();
    // Every second contact is in the group: 75 of 150
    const members = inserted.filter((_, index) => index % 2 === 0);
    await getDb()
      .insert(contactGroups)
      .values(members.map((contact) => ({ contactId: contact.id, groupId: group.id })));

    const second = await listContacts(OWNER, "", [group.id], { offset: 50, limit: PAGE_SIZE });
    const whole = await listContacts(OWNER, "", [group.id]);

    expect(whole).toHaveLength(75);
    expect(second.map((item) => item.id)).toEqual(whole.slice(50).map((item) => item.id));
    expect(second).toHaveLength(25);
  });
});

describe("countContacts: how many are found", () => {
  it("counts all the contacts of the owner without a search and groups", async () => {
    await insertContacts(numberedNames(130));
    await insertContacts(numberedNames(20), "user-other");

    expect(await countContacts(OWNER)).toBe(130);
  });

  it("counts the contacts found by a search", async () => {
    await insertContacts(["Иванов Пётр", "Иванова Анна", "Сидоров Олег", "Ёлкин Иван"]);

    expect(await countContacts(OWNER, "иванов")).toBe(2);
    // «е» and «ё» are one letter, as in the search of the list
    expect(await countContacts(OWNER, "елкин")).toBe(1);
    expect(await countContacts(OWNER, "никого")).toBe(0);
  });

  it("counts the contacts of the chosen groups", async () => {
    const inserted = await insertContacts(["Анна", "Борис", "Вера", "Глеб"]);
    const [tennis, chess] = await getDb()
      .insert(groups)
      .values([
        { ownerId: OWNER, name: "Теннис" },
        { ownerId: OWNER, name: "Шахматы" },
      ])
      .returning();
    await getDb()
      .insert(contactGroups)
      .values([
        { contactId: inserted[0].id, groupId: tennis.id },
        { contactId: inserted[1].id, groupId: tennis.id },
        { contactId: inserted[2].id, groupId: tennis.id },
        { contactId: inserted[1].id, groupId: chess.id },
        { contactId: inserted[3].id, groupId: chess.id },
      ]);

    expect(await countContacts(OWNER, "", [tennis.id])).toBe(3);
    // A contact must be in every chosen group
    expect(await countContacts(OWNER, "", [tennis.id, chess.id])).toBe(1);
  });

  it("counts by the search and the groups together", async () => {
    const inserted = await insertContacts(["Иван Первый", "Иван Второй", "Пётр Третий"]);
    const [group] = await getDb()
      .insert(groups)
      .values({ ownerId: OWNER, name: "Теннис" })
      .returning();
    await getDb()
      .insert(contactGroups)
      .values([
        { contactId: inserted[0].id, groupId: group.id },
        { contactId: inserted[2].id, groupId: group.id },
      ]);

    expect(await countContacts(OWNER, "иван", [group.id])).toBe(1);
  });

  it("agrees with the number of contacts the list returns", async () => {
    await insertContacts(["Иванов Пётр", "Иванова Анна", "Сидоров Олег"]);

    expect(await countContacts(OWNER, "иванов")).toBe((await listContacts(OWNER, "иванов")).length);
  });
});

describe("contactListPosition: where a contact stands in the list", () => {
  it("is the place of the contact in the list without a search and groups, from 1", async () => {
    const inserted = await insertContacts(["Борис", "Алла", "Вера"]);
    const whole = await listContacts(OWNER);

    for (const contact of inserted) {
      const place = whole.findIndex((item) => item.id === contact.id) + 1;
      expect(await contactListPosition(OWNER, contact.id)).toBe(place);
    }
    expect(await contactListPosition(OWNER, inserted[1].id)).toBe(1);
  });

  it("puts «ё» next to «е» and equal names in the order of their ids, as the list does", async () => {
    const inserted = await insertContacts([
      "Фёдор",
      "Иван",
      "Ёлкин",
      "Елена",
      "Иван",
      "Евгений",
      "Иван",
      "Алла",
    ]);
    const whole = await listContacts(OWNER);

    for (const contact of inserted) {
      const place = whole.findIndex((item) => item.id === contact.id) + 1;
      expect(await contactListPosition(OWNER, contact.id)).toBe(place);
    }
  });

  it("gives the page of a contact at the end of 250: the third", async () => {
    await insertContacts(numberedNames(250));
    const [last] = await insertContacts(["Яна Яковлева"]);

    const position = await contactListPosition(OWNER, last.id);

    expect(position).toBe(251);
    expect(Math.ceil(position! / PAGE_SIZE)).toBe(3);
  });

  it("is null for a contact that does not exist", async () => {
    await insertContacts(["Анна"]);

    expect(await contactListPosition(OWNER, 999_999)).toBeNull();
  });
});
