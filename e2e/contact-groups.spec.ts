// Scenarios from openspec/specs/contact-groups/spec.md, walked through in the browser:
// each test is a user path, each step is one or more scenarios of the spec.
// The rules themselves (names, addresses, texts) are checked by the unit tests in src/lib;
// here they are checked as the user sees them, on a real database.
// Not covered here: renaming a group and the group link on the "Группы" page.

import { type Page } from "@playwright/test";

import { daysAgo } from "./dates";
import { signIn } from "./auth";
import { expect, test } from "./fixtures";
import { countContacts, insertContact, insertGroup } from "./test-database";

// Colors of the design tokens in src/styles/tokens.css, as the browser reports them
const ACCENT_PINK = "rgb(255, 143, 199)"; // --color-accent
const WHITE = "rgb(255, 255, 255)";

// The number of a group that does not exist
const MISSING_GROUP_ID = 999_999;

// Every test is a user of its own, with no contacts and no groups, so the scenarios that depend on
// which groups exist start from nothing

// Rows of the general list: each letter is a section named "На букву …"
function listRegion(page: Page) {
  return page.getByRole("region", { name: /^На букву/ });
}

function listLink(page: Page, name: string) {
  return listRegion(page).getByRole("link", { name });
}

// The list shows exactly these contacts, in this order
async function expectList(page: Page, names: string[]) {
  await expect(listRegion(page).getByRole("listitem")).toHaveText(
    names.map((name) => new RegExp(name)),
  );
}

function groupCheckbox(page: Page, name: string) {
  return page.getByRole("checkbox", { name, exact: true });
}

function newGroupField(page: Page) {
  return page.getByRole("textbox", { name: "Новая группа" });
}

async function addNewGroupInForm(page: Page, name: string) {
  await newGroupField(page).fill(name);
  await page.getByRole("button", { name: "Добавить", exact: true }).click();
}

// The value of the "Группы" row in the contact card
function groupsRow(page: Page) {
  return page
    .getByRole("term")
    .filter({ hasText: "Группы" })
    .locator("xpath=following-sibling::dd[1]");
}

// Fills the name in the open form of a new contact, saves it and opens its card from the list
async function saveNewContact(page: Page, name: string) {
  await page.getByLabel("Имя и фамилия").fill(name);
  await page.getByRole("button", { name: "Добавить контакт" }).click();
  await expect(page.getByText(`Контакт «${name}» добавлен`)).toBeVisible();
  await listLink(page, name).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

async function openEditForm(page: Page) {
  await page.getByRole("link", { name: "Изменить" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Изменить контакт" })).toBeVisible();
}

function filterNav(page: Page) {
  return page.getByRole("navigation", { name: "Группы" });
}

function filterButton(page: Page, name: string) {
  return filterNav(page).getByRole("link", { name, exact: true });
}

async function expectFilterButton(page: Page, name: string, selected: boolean) {
  const button = filterButton(page, name);
  await expect(button).toHaveAttribute("aria-pressed", String(selected));
  await expect(button).toHaveCSS("background-color", selected ? ACCENT_PINK : WHITE);
}

// "Все" is highlighted and the counter shows all contacts: no group is selected
async function expectNoFilter(page: Page, counter: string) {
  await expect(filterButton(page, "Все")).toHaveAttribute("aria-current", "true");
  await expect(page.getByText(counter, { exact: true })).toBeVisible();
}

function searchField(page: Page) {
  return page.getByRole("searchbox", { name: "Найти контакт по имени" });
}

// A row of the "Группы" page
function groupRow(page: Page, name: string) {
  return page.getByRole("listitem").filter({ has: page.getByRole("link", { name, exact: true }) });
}

function confirmDialog(page: Page) {
  return page.getByRole("alertdialog");
}

async function deleteGroupOnGroupsPage(page: Page, name: string) {
  await groupRow(page, name).getByRole("button", { name: "Удалить" }).click();
  await confirmDialog(page).getByRole("button", { name: "Удалить", exact: true }).click();
  await expect(page.getByText(`Группа «${name}» удалена`)).toBeVisible();
  await expect(groupRow(page, name)).toHaveCount(0);
}

test("first groups in the form: the hint, wrong names, a new group, several groups, no groups", async ({
  page,
}) => {
  let tennis = 0;

  await test.step("first group in the app: a hint instead of check marks", async () => {
    await page.goto("/contacts/new");
    await expect(
      page.getByText("Групп пока нет. Впишите название, чтобы создать первую"),
    ).toBeVisible();
    await expect(page.getByRole("checkbox")).toHaveCount(0);
  });

  await test.step("empty name: an error under the field, no group", async () => {
    for (const name of ["", "   "]) {
      await addNewGroupInForm(page, name);
      await expect(page.getByText("Укажите название группы")).toBeVisible();
      await expect(page.getByRole("checkbox")).toHaveCount(0);
    }
  });

  await test.step("too long name: an error under the field, no group", async () => {
    await addNewGroupInForm(page, "а".repeat(51));
    await expect(page.getByText("Не длиннее 50 символов")).toBeVisible();
    await expect(page.getByRole("checkbox")).toHaveCount(0);
  });

  await test.step("new group right in the form: checked, created with the contact, offered to the next one", async () => {
    await addNewGroupInForm(page, "Аналитики");
    await expect(groupCheckbox(page, "Аналитики (новая)")).toBeChecked();
    await expect(newGroupField(page)).toHaveValue("");
    await expect(page.getByText("Не длиннее 50 символов")).toHaveCount(0);

    await saveNewContact(page, "Алиса Морозова");
    await expect(groupsRow(page)).toHaveText("Аналитики");

    await page.goto("/contacts/new");
    await expect(groupCheckbox(page, "Аналитики")).not.toBeChecked();
    await expect(page.getByText("(новая)")).toHaveCount(0);
  });

  await test.step("contact in several groups: both in the card and checked in the edit form", async () => {
    await insertGroup("Семья");
    tennis = await insertGroup("Теннис");
    await page.goto("/contacts/new");
    await groupCheckbox(page, "Семья").click();
    await groupCheckbox(page, "Теннис").click();
    await saveNewContact(page, "Борис Ковалёв");
    await expect(groupsRow(page)).toHaveText("Семья, Теннис");

    await openEditForm(page);
    await expect(groupCheckbox(page, "Семья")).toBeChecked();
    await expect(groupCheckbox(page, "Теннис")).toBeChecked();
    await expect(groupCheckbox(page, "Аналитики")).not.toBeChecked();
  });

  await test.step("groups in the card go in alphabetical order", async () => {
    // «Друзья» is created after «Теннис», so only the sorting puts it first
    const friends = await insertGroup("Друзья");
    const id = await insertContact({ name: "Вера Лебедева", groupIds: [tennis, friends] });
    await page.goto(`/contacts/${id}`);
    await expect(groupsRow(page)).toHaveText("Друзья, Теннис");
  });

  await test.step("contact without groups: «Не указано» in the card", async () => {
    await page.goto("/contacts/new");
    await saveNewContact(page, "Глеб Без Групп");
    await expect(groupsRow(page)).toHaveText("Не указано");
  });
});

test("second thoughts in the form: a repeated name, cancel, a form error, removing a group", async ({
  page,
}) => {
  const family = await insertGroup("Семья");
  const tennis = await insertGroup("Теннис");
  await insertGroup("Тётя");

  await test.step("a name that exists in another case: the existing group is checked, no new one", async () => {
    await page.goto("/contacts/new");
    await addNewGroupInForm(page, "теннис");
    await expect(groupCheckbox(page, "Теннис")).toBeChecked();
    await expect(newGroupField(page)).toHaveValue("");
    await expect(page.getByText("(новая)")).toHaveCount(0);
    await expect(page.getByRole("checkbox")).toHaveCount(3);
  });

  await test.step("a name that differs only in «е» and «ё»: the existing group is checked, no new one", async () => {
    await addNewGroupInForm(page, "тетя");
    await expect(groupCheckbox(page, "Тётя")).toBeChecked();
    await expect(page.getByText("(новая)")).toHaveCount(0);
    await expect(page.getByRole("checkbox")).toHaveCount(3);

    await saveNewContact(page, "Анна Смирнова");
    await expect(groupsRow(page)).toHaveText("Теннис, Тётя");
    await openEditForm(page);
    await expect(page.getByRole("checkbox")).toHaveCount(3);
  });

  await test.step("cancelling the form: the new group is created nowhere", async () => {
    await page.goto("/contacts/new");
    await addNewGroupInForm(page, "Шахматы");
    await expect(groupCheckbox(page, "Шахматы (новая)")).toBeChecked();
    await page.getByRole("link", { name: "Отмена" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Контакты" })).toBeVisible();
    await expect(filterButton(page, "Теннис")).toBeVisible();
    await expect(filterButton(page, "Шахматы")).toHaveCount(0);

    await page.goto("/contacts/new");
    await expect(groupCheckbox(page, "Теннис")).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /Шахматы/ })).toHaveCount(0);
  });

  await test.step("an error in the form keeps the check marks and the added groups", async () => {
    const contactsBefore = await countContacts();
    await groupCheckbox(page, "Семья").click();
    await addNewGroupInForm(page, "Аналитики");
    await page.getByRole("button", { name: "Добавить контакт" }).click();

    await expect(page.getByText("Укажите имя")).toBeVisible();
    await expect(page).toHaveURL(/\/contacts\/new$/);
    await expect(groupCheckbox(page, "Семья")).toBeChecked();
    await expect(groupCheckbox(page, "Теннис")).not.toBeChecked();
    await expect(groupCheckbox(page, "Аналитики (новая)")).toBeChecked();
    expect(await countContacts()).toBe(contactsBefore);
  });

  await test.step("removed from a group: gone from the card and from the filter of the group", async () => {
    const name = "Олег Петров";
    const id = await insertContact({ name, groupIds: [family, tennis] });
    await page.goto(`/contacts/${id}`);
    await expect(groupsRow(page)).toHaveText("Семья, Теннис");

    await openEditForm(page);
    await groupCheckbox(page, "Теннис").click();
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(groupsRow(page)).toHaveText("Семья");

    await page.goto("/");
    await expect(listLink(page, name)).toBeVisible();
    await filterButton(page, "Теннис").click();
    // Анна stays in the group, so the list is not empty when Олег is gone from it
    await expectList(page, ["Анна Смирнова"]);
  });
});

test("contact added before the groups: «Не указано», other fields and notes are as they were", async ({
  page,
}) => {
  await insertGroup("Теннис");
  const id = await insertContact({
    name: "Олег Старый",
    phone: "+7 900 000-00-01",
    notes: [{ body: "Познакомились на конференции", createdAt: daysAgo(400) }],
  });

  await page.goto(`/contacts/${id}`);
  await expect(groupsRow(page)).toHaveText("Не указано");
  await expect(page.getByRole("link", { name: "+7 900 000-00-01" })).toBeVisible();
  await expect(page.getByText("Познакомились на конференции")).toBeVisible();

  await openEditForm(page);
  await expect(groupCheckbox(page, "Теннис")).not.toBeChecked();
  await expect(page.getByLabel("Телефон")).toHaveValue("+7 900 000-00-01");
});

test("no groups in the app: no filter buttons and no link to the groups page", async ({ page }) => {
  await insertContact({ name: "Анна Смирнова" });

  await page.goto("/");
  await expectList(page, ["Анна Смирнова"]);
  await expect(filterNav(page)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Управление группами" })).toHaveCount(0);
});

test("filter on the home page: one and several groups, search, reset, address, empty lists", async ({
  page,
  browser,
  baseURL,
  userEmail,
}) => {
  const family = await insertGroup("Семья");
  const tennis = await insertGroup("Теннис");
  const books = await insertGroup("Книги");
  await insertGroup("Шахматы");
  await insertContact({ name: "Анна Смирнова", groupIds: [family, tennis] });
  await insertContact({ name: "Борис Ковалёв", groupIds: [books] });
  await insertContact({ name: "Иван Петров", groupIds: [tennis] });
  await insertContact({ name: "Иван Сидоров", groupIds: [family] });
  const everyone = ["Анна Смирнова", "Борис Ковалёв", "Иван Петров", "Иван Сидоров"];

  await test.step("one group: only its members, the button is highlighted, the counter shows N of M", async () => {
    await page.goto("/");
    await expectList(page, everyone);
    await expectNoFilter(page, "4 контакта");

    await filterButton(page, "Теннис").click();
    await expectList(page, ["Анна Смирнова", "Иван Петров"]);
    await expectFilterButton(page, "Теннис", true);
    await expectFilterButton(page, "Семья", false);
    await expect(filterButton(page, "Все")).not.toHaveAttribute("aria-current");
    await expect(page.getByText("Найдено: 2 из 4 контактов", { exact: true })).toBeVisible();
  });

  await test.step("several groups: only those who are in all of them", async () => {
    await filterButton(page, "Семья").click();
    await expectList(page, ["Анна Смирнова"]);
    await expectFilterButton(page, "Теннис", true);
    await expectFilterButton(page, "Семья", true);
    await expect(page.getByText("Найдено: 1 из 4 контактов", { exact: true })).toBeVisible();
  });

  await test.step("pressing a selected group again turns it off", async () => {
    await filterButton(page, "Семья").click();
    await expectList(page, ["Анна Смирнова", "Иван Петров"]);
    await expectFilterButton(page, "Семья", false);
  });

  await test.step("filter and search together", async () => {
    await searchField(page).fill("Иван");
    await expectList(page, ["Иван Петров"]);
    await expect(page).toHaveURL(new RegExp(`\\?q=.+&group=${tennis}$`));
    await expectFilterButton(page, "Теннис", true);
  });

  await test.step("nothing found in the group", async () => {
    await searchField(page).fill("Зоя");
    await expect(
      page.getByText("Никого не нашли по запросу «Зоя» в выбранных группах"),
    ).toBeVisible();
    await expect(listRegion(page)).toHaveCount(0);
  });

  await test.step("resetting the filter: «Все» shows the whole list", async () => {
    await searchField(page).fill("");
    await expect(page).toHaveURL(new RegExp(`/\\?group=${tennis}$`));
    await filterButton(page, "Все").click();

    await expect(page).toHaveURL(/\/$/);
    await expectList(page, everyone);
    await expectNoFilter(page, "4 контакта");
    await expectFilterButton(page, "Теннис", false);
  });

  await test.step("filter in the address: the same after a reload and in another browser", async () => {
    await filterButton(page, "Теннис").click();
    await expect(page).toHaveURL(new RegExp(`/\\?group=${tennis}$`));
    await page.reload();
    await expectList(page, ["Анна Смирнова", "Иван Петров"]);
    await expectFilterButton(page, "Теннис", true);

    // A new context is a clean browser: no cookies, no storage, nothing shared with the first one
    const otherBrowser = await browser.newContext({ baseURL });
    try {
      const otherPage = await otherBrowser.newPage();
      // Another browser is another device: it signs in under the same address
      await signIn(otherPage, userEmail);
      await otherPage.goto(page.url());
      await expectList(otherPage, ["Анна Смирнова", "Иван Петров"]);
      await expectFilterButton(otherPage, "Теннис", true);
    } finally {
      await otherBrowser.close();
    }
  });

  await test.step("a group without contacts", async () => {
    await page.goto("/");
    await filterButton(page, "Шахматы").click();
    await expect(page.getByText("В этой группе пока нет контактов")).toBeVisible();
    await expect(listRegion(page)).toHaveCount(0);
    await expect(page.getByText("Найдено: 0 из 4 контактов", { exact: true })).toBeVisible();
  });

  await test.step("no shared contacts: both groups have members, nobody is in both", async () => {
    await page.goto("/");
    await filterButton(page, "Книги").click();
    await expectList(page, ["Борис Ковалёв"]);
    await filterButton(page, "Теннис").click();
    await expect(
      page.getByText("Нет контактов, которые входят во все выбранные группы"),
    ).toBeVisible();
    await expect(listRegion(page)).toHaveCount(0);
  });

  await test.step("a group from the address that does not exist is ignored", async () => {
    await page.goto(`/?group=${MISSING_GROUP_ID}`);
    await expectList(page, everyone);
    await expectNoFilter(page, "4 контакта");

    await page.goto(`/?group=${tennis}&group=${MISSING_GROUP_ID}`);
    await expectList(page, ["Анна Смирнова", "Иван Петров"]);
    await expectFilterButton(page, "Теннис", true);
  });
});

test("the keep-in-touch block is hidden while a group is selected", async ({ page }) => {
  const tennis = await insertGroup("Теннис");
  await insertContact({
    name: "Анна Смирнова",
    frequency: "week",
    since: daysAgo(10),
    groupIds: [tennis],
  });
  const block = page.getByRole("region", { name: "Пора связаться" });

  await page.goto("/");
  await expect(block).toBeVisible();

  await filterButton(page, "Теннис").click();
  await expect(page).toHaveURL(new RegExp(`/\\?group=${tennis}$`));
  await expectList(page, ["Анна Смирнова"]);
  await expect(block).toHaveCount(0);

  await filterButton(page, "Все").click();
  await expect(block).toBeVisible();
});

test("deleting a group: the question, cancel, deleted, the contacts stay", async ({ page }) => {
  const tennis = await insertGroup("Теннис");
  const family = await insertGroup("Семья");
  const annaId = await insertContact({ name: "Анна Смирнова", groupIds: [tennis, family] });
  const borisId = await insertContact({ name: "Борис Ковалёв", groupIds: [tennis] });
  await insertContact({ name: "Вера Лебедева", groupIds: [tennis] });
  await insertContact({ name: "Глеб Соколов", groupIds: [tennis] });
  const everyone = ["Анна Смирнова", "Борис Ковалёв", "Вера Лебедева", "Глеб Соколов"];

  await test.step("the question names the group and its contacts, the group is still there", async () => {
    await page.goto("/groups");
    await expect(groupRow(page, "Теннис")).toContainText("4 контакта");
    await groupRow(page, "Теннис").getByRole("button", { name: "Удалить" }).click();
    await expect(
      confirmDialog(page).getByText("Группа «Теннис» удалится, 4 контакта останутся без неё", {
        exact: true,
      }),
    ).toBeVisible();

    await page.reload();
    await expect(groupRow(page, "Теннис")).toContainText("4 контакта");
  });

  await test.step("cancelling: the group and its members are in place", async () => {
    await groupRow(page, "Теннис").getByRole("button", { name: "Удалить" }).click();
    await confirmDialog(page).getByRole("button", { name: "Отмена" }).click();
    await expect(confirmDialog(page)).toHaveCount(0);
    await expect(groupRow(page, "Теннис")).toContainText("4 контакта");

    await page.goto(`/?group=${tennis}`);
    await expectList(page, everyone);
  });

  await test.step("deleted: no group on the page, in the filter and in the form, the contacts stay", async () => {
    await page.goto("/groups");
    await deleteGroupOnGroupsPage(page, "Теннис");
    await expect(groupRow(page, "Семья")).toBeVisible();

    await page.goto("/");
    await expectList(page, everyone);
    await expect(filterButton(page, "Семья")).toBeVisible();
    await expect(filterButton(page, "Теннис")).toHaveCount(0);

    await page.goto("/contacts/new");
    await expect(groupCheckbox(page, "Семья")).toBeVisible();
    await expect(groupCheckbox(page, "Теннис")).toHaveCount(0);

    await page.goto(`/contacts/${annaId}`);
    await expect(groupsRow(page)).toHaveText("Семья");
    await page.goto(`/contacts/${borisId}`);
    await expect(groupsRow(page)).toHaveText("Не указано");
  });
});

test("deleting a group that is selected in the filter: the home page shows the full list", async ({
  page,
}) => {
  const tennis = await insertGroup("Теннис");
  const family = await insertGroup("Семья");
  await insertContact({ name: "Анна Смирнова", groupIds: [tennis] });
  await insertContact({ name: "Борис Ковалёв", groupIds: [family] });
  const everyone = ["Анна Смирнова", "Борис Ковалёв"];

  await page.goto("/");
  await filterButton(page, "Теннис").click();
  await expectList(page, ["Анна Смирнова"]);

  await page.getByRole("link", { name: "Управление группами" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Группы" })).toBeVisible();
  await deleteGroupOnGroupsPage(page, "Теннис");

  await test.step("back by the link to all contacts", async () => {
    await page.getByRole("link", { name: "Все контакты" }).click();
    await expectList(page, everyone);
    await expectNoFilter(page, "2 контакта");
    await expect(filterButton(page, "Теннис")).toHaveCount(0);
  });

  await test.step("back by the old address with the number of the deleted group", async () => {
    await page.goto(`/?group=${tennis}`);
    await expectList(page, everyone);
    await expectNoFilter(page, "2 контакта");
  });
});

test("deleting a contact: its groups stay, each has one contact less", async ({ page }) => {
  const tennis = await insertGroup("Теннис");
  const family = await insertGroup("Семья");
  const annaId = await insertContact({ name: "Анна Смирнова", groupIds: [tennis, family] });
  await insertContact({ name: "Борис Ковалёв", groupIds: [tennis] });

  await page.goto("/groups");
  await expect(groupRow(page, "Теннис")).toContainText("2 контакта");
  await expect(groupRow(page, "Семья")).toContainText("1 контакт");

  await page.goto(`/contacts/${annaId}`);
  await page.getByRole("button", { name: "Удалить" }).click();
  await confirmDialog(page).getByRole("button", { name: "Удалить", exact: true }).click();
  await expect(page.getByText("Контакт «Анна Смирнова» удалён")).toBeVisible();
  await expectList(page, ["Борис Ковалёв"]);

  await page.goto("/groups");
  await expect(groupRow(page, "Теннис")).toContainText("1 контакт");
  await expect(groupRow(page, "Семья")).toContainText("0 контактов");
});

test("group names on a phone: one line when they fit, whole words, buttons below", async ({
  page,
}) => {
  const shortName = "Теннис";
  const middleName = "Коллеги с прошлой работы";
  const longName = "Очень длинное название группы ровно на пятьдесят с";
  for (const name of [shortName, middleName, longName]) {
    await insertGroup(name);
  }

  function nameLink(name: string) {
    return groupRow(page, name).getByRole("link", { name, exact: true });
  }

  // An inline element has one box per line it takes on the screen
  function lineCount(name: string) {
    return nameLink(name).evaluate((link) => link.getClientRects().length);
  }

  // Words of the name that are split between two lines
  function brokenWords(name: string) {
    return nameLink(name).evaluate((link) => {
      const text = link.firstChild as Text;
      return [...text.data.matchAll(/\S+/g)]
        .filter((word) => {
          const range = document.createRange();
          range.setStart(text, word.index);
          range.setEnd(text, word.index + word[0].length);
          return range.getClientRects().length > 1;
        })
        .map((word) => word[0]);
    });
  }

  // The block of the name with its number of contacts and the two buttons of the row
  async function rowBoxes(name: string) {
    const row = groupRow(page, name);
    return {
      block: (await nameLink(name).locator("..").boundingBox())!,
      rename: (await row.getByRole("button", { name: "Переименовать" }).boundingBox())!,
      remove: (await row.getByRole("button", { name: "Удалить" }).boundingBox())!,
    };
  }

  for (const width of [320, 390, 430]) {
    await test.step(`a phone ${width} wide`, async () => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/groups");

      expect(await lineCount(shortName)).toBe(1);
      expect(await lineCount(middleName)).toBe(1);
      expect(await lineCount(longName)).toBeLessThanOrEqual(2);
      expect(await brokenWords(longName)).toEqual([]);

      for (const name of [shortName, middleName, longName]) {
        const { block, rename, remove } = await rowBoxes(name);
        expect(rename.y).toBeGreaterThanOrEqual(block.y + block.height);
        expect(remove.y).toBeGreaterThanOrEqual(block.y + block.height);
        expect(rename.x + rename.width).toBeLessThanOrEqual(block.x + block.width);
        expect(remove.x + remove.width).toBeLessThanOrEqual(block.x + block.width);
      }

      const sidewaysScroll = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(sidewaysScroll).toBeLessThanOrEqual(0);
    });
  }

  await test.step("a computer: the buttons stay to the right of the name", async () => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/groups");

    expect(await lineCount(shortName)).toBe(1);
    const { block, rename } = await rowBoxes(shortName);
    expect(rename.x).toBeGreaterThanOrEqual(block.x + block.width);
    expect(rename.y).toBeLessThan(block.y + block.height);
  });
});
