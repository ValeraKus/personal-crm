// Scenarios from openspec/specs/data-ownership/spec.md and the new scenarios of
// openspec/specs/contact-groups/spec.md, walked through in the browser with two people:
// A is the signed-in `page`, B is `otherUser.page` in another browser.
// Not here: the scenarios «Данные, которые были до входа» and «Демо-данные у владельца» (the tests on
// the database check them, see src/db) and the requests to the server with a number of somebody
// else's contact, note or group (a browser cannot send them, the database tests do).

import { randomUUID } from "node:crypto";

import { type Page } from "@playwright/test";

import { requestLink } from "./auth";
import { expect, test } from "./fixtures";
import { waitForLoginLink } from "./mailpit";
import { makeOverdue } from "./test-database";

function listRegion(page: Page) {
  return page.getByRole("region", { name: /^На букву/ });
}

function listLink(page: Page, name: string) {
  return listRegion(page).getByRole("link", { name });
}

function keepInTouchBlock(page: Page) {
  return page.getByRole("region", { name: "Пора связаться" });
}

function filterNav(page: Page) {
  return page.getByRole("navigation", { name: "Группы" });
}

function filterButton(page: Page, name: string) {
  return filterNav(page).getByRole("link", { name, exact: true });
}

function searchField(page: Page) {
  return page.getByRole("searchbox", { name: "Найти контакт по имени" });
}

function notFoundHeading(page: Page) {
  return page.getByRole("heading", { name: "Контакт не найден" });
}

// Adds a contact through the form, with a new group and a weekly term if asked
async function addContact(
  page: Page,
  name: string,
  options: { group?: string; weekly?: boolean } = {},
) {
  await page.goto("/contacts/new");
  await page.getByLabel("Имя и фамилия").fill(name);
  if (options.weekly) {
    await page.getByRole("radio", { name: "Раз в неделю", exact: true }).click();
  }
  if (options.group) {
    await page.getByRole("textbox", { name: "Новая группа" }).fill(options.group);
    await page.getByRole("button", { name: "Добавить", exact: true }).click();
  }
  await page.getByRole("button", { name: "Добавить контакт" }).click();
  await expect(page.getByText(`Контакт «${name}» добавлен`)).toBeVisible();
}

// The address of the card of a contact in the list
async function cardUrlOf(page: Page, name: string) {
  await page.goto("/");
  await listLink(page, name).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  return page.url();
}

test("two users do not see each other's contacts", async ({ page, otherUser }) => {
  const b = otherUser.page;
  // A unique mark in every name: names of other tests never get in the way
  const mark = randomUUID().slice(0, 6);
  const nameA = `Анна Антонова ${mark}`;
  const nameB = `Борис Беляев ${mark}`;
  await addContact(page, nameA);
  await addContact(b, nameB);
  const cardA = await cardUrlOf(page, nameA);
  const cardB = await cardUrlOf(b, nameB);

  await test.step("scenario «Два пользователя»: B has no contact of A in the list, in the search or in the counter", async () => {
    await b.goto("/");
    await expect(listLink(b, nameB)).toBeVisible();
    await expect(listLink(b, nameA)).toHaveCount(0);
    await expect(b.getByText("1 контакт", { exact: true })).toBeVisible();

    await searchField(b).fill(nameA);
    await expect(b.getByText(`Никого не нашли по запросу «${nameA}»`)).toBeVisible();
  });

  await test.step("scenario «Два пользователя»: A has no contact of B, either", async () => {
    await page.goto("/");
    await expect(listLink(page, nameA)).toBeVisible();
    await expect(listLink(page, nameB)).toHaveCount(0);
    await expect(page.getByText("1 контакт", { exact: true })).toBeVisible();

    await searchField(page).fill(nameB);
    await expect(page.getByText(`Никого не нашли по запросу «${nameB}»`)).toBeVisible();
  });

  await test.step("scenario «Прямая ссылка на чужой контакт»: «Контакт не найден» for the card and the edit form", async () => {
    await b.goto(cardA);
    await expect(notFoundHeading(b)).toBeVisible();
    await expect(b.getByText(nameA)).toHaveCount(0);
    await b.goto(`${cardA}/edit`);
    await expect(notFoundHeading(b)).toBeVisible();

    await page.goto(cardB);
    await expect(notFoundHeading(page)).toBeVisible();
    await page.goto(`${cardB}/edit`);
    await expect(notFoundHeading(page)).toBeVisible();
  });

  await test.step("scenario «Несуществующий контакт»: the same message", async () => {
    await page.goto("/contacts/999999");
    await expect(notFoundHeading(page)).toBeVisible();
    await page.goto("/contacts/999999/edit");
    await expect(notFoundHeading(page)).toBeVisible();
  });
});

test("groups and overdue contacts of one user are not seen by the other", async ({
  page,
  otherUser,
}) => {
  const b = otherUser.page;
  const mark = randomUUID().slice(0, 6);
  const group = `Теннис ${mark}`;
  const overdue = `Просрочена Анна ${mark}`;
  await addContact(page, overdue, { group, weekly: true });
  await makeOverdue(overdue);
  await addContact(b, `Борис ${mark}`);

  await test.step("A sees the group and the overdue contact", async () => {
    await page.goto("/");
    await expect(filterButton(page, group)).toBeVisible();
    await expect(
      keepInTouchBlock(page).getByRole("link", { name: new RegExp(overdue) }),
    ).toBeVisible();
  });

  await test.step("scenario «Чужие группы не видны»: not in the filter, the contact form or the groups page", async () => {
    await b.goto("/");
    await expect(filterNav(b)).toHaveCount(0);
    await expect(b.getByText(group)).toHaveCount(0);

    await b.goto("/contacts/new");
    await expect(b.getByRole("checkbox")).toHaveCount(0);
    await expect(b.getByText(group)).toHaveCount(0);

    await b.goto("/groups");
    await expect(b.getByText(group)).toHaveCount(0);
    await expect(b.getByText("Групп пока нет")).toBeVisible();
  });

  await test.step("scenario «Чужие просроченные контакты не видны»: no block «Пора связаться» for B", async () => {
    await b.goto("/");
    await expect(keepInTouchBlock(b)).toHaveCount(0);
    await expect(b.getByText(overdue)).toHaveCount(0);
  });

  await test.step("scenario «Чужая группа в адресе»: the number is ignored, B sees the whole list", async () => {
    const href = await filterButton(page, group).getAttribute("href");
    await b.goto(href!);

    await expect(b.getByRole("heading", { level: 1, name: "Контакты" })).toBeVisible();
    await expect(listLink(b, `Борис ${mark}`)).toBeVisible();
    await expect(b.getByText("1 контакт", { exact: true })).toBeVisible();
  });
});

test("a new user: an empty list with a hint, no groups, no block «Пора связаться»", async ({
  otherUser,
}) => {
  await test.step("scenario «Первый вход»", async () => {
    const b = otherUser.page;
    await b.goto("/");

    await expect(b.getByText("Пока нет ни одного контакта")).toBeVisible();
    await expect(b.getByText("Добавьте первый контакт")).toBeVisible();
    await expect(filterNav(b)).toHaveCount(0);
    await expect(keepInTouchBlock(b)).toHaveCount(0);
    await expect(b.getByRole("link", { name: "Управление группами" })).toHaveCount(0);
  });
});

test("a link to another address: inside under that address, with its contacts", async ({
  page,
  otherUser,
  browser,
  baseURL,
}) => {
  const mark = randomUUID().slice(0, 6);
  const nameA = `Анна Антонова ${mark}`;
  const nameB = `Борис Беляев ${mark}`;
  await addContact(page, nameA);
  await addContact(otherUser.page, nameB);

  await test.step("scenario «Ссылка под другой почтой» (the part about the contacts)", async () => {
    // B asks for a link in a clean browser, A opens it in the browser where A is signed in
    const clean = await browser.newContext({ baseURL });
    try {
      await requestLink(await clean.newPage(), otherUser.email);
    } finally {
      await clean.close();
    }
    await page.goto(await waitForLoginLink(otherUser.email, 2));

    await expect(page.getByRole("banner").getByText(otherUser.email)).toBeVisible();
    await expect(listLink(page, nameB)).toBeVisible();
    await expect(listLink(page, nameA)).toHaveCount(0);
  });
});

async function openGroupsPage(page: Page) {
  await page.goto("/groups");
  await expect(page.getByRole("heading", { level: 1, name: "Группы" })).toBeVisible();
}

function groupRow(page: Page, name: string) {
  return page.getByRole("listitem").filter({ has: page.getByRole("link", { name, exact: true }) });
}

test("the same group name for two users: separate groups, renaming into somebody else's name", async ({
  page,
  otherUser,
}) => {
  const b = otherUser.page;
  const mark = randomUUID().slice(0, 6);
  const nameA = `Анна ${mark}`;
  const nameB = `Борис ${mark}`;

  await test.step("scenario «Такое же название у другого пользователя»: each has a group of his own", async () => {
    await addContact(page, nameA, { group: "Друзья" });
    await addContact(b, nameB, { group: "Друзья" });

    await b.goto("/");
    await filterButton(b, "Друзья").click();
    await expect(listLink(b, nameB)).toBeVisible();
    await expect(listLink(b, nameA)).toHaveCount(0);

    await page.goto("/");
    await filterButton(page, "Друзья").click();
    await expect(listLink(page, nameA)).toBeVisible();
    await expect(listLink(page, nameB)).toHaveCount(0);
  });

  await test.step("scenario «Переименование в название чужой группы»: it is saved, the group of A is as it was", async () => {
    await addContact(page, `Теннисист ${mark}`, { group: "Теннис" });
    await addContact(b, `Шахматист ${mark}`, { group: "Шахматы" });

    await openGroupsPage(b);
    await groupRow(b, "Шахматы").getByRole("button", { name: "Переименовать" }).click();
    await b.getByRole("textbox", { name: "Название группы" }).fill("Теннис");
    await b.getByRole("button", { name: "Сохранить" }).click();
    await expect(groupRow(b, "Теннис")).toBeVisible();
    await expect(b.getByText("Группа с таким названием уже есть")).toHaveCount(0);

    await openGroupsPage(page);
    await expect(groupRow(page, "Теннис")).toContainText("1 контакт");
    await expect(groupRow(page, "Шахматы")).toHaveCount(0);
  });
});
