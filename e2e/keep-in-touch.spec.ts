// Scenarios from openspec/specs/keep-in-touch/spec.md, walked through in the browser:
// each test is a user path, each step is one or more scenarios of the spec.
// The term rules themselves (labels, due dates, overdue days, order) are checked by the unit tests
// in src/lib; here they are checked as the user sees them.

import { expect, test, type Page } from "@playwright/test";

import { addDays, addMonths, daysAgo, dueDateText, noteDayText, today } from "./dates";
import { countContacts, deleteAllContacts, insertContact } from "./test-database";

// Colors of the design tokens in src/styles/tokens.css, as the browser reports them
const ACCENT_PINK = "rgb(255, 143, 199)"; // --color-accent
const DANGER_RED = "rgb(194, 24, 91)"; // --color-danger

// The home block shows every overdue contact of the database: each test starts from an empty one
test.beforeEach(async () => {
  await deleteAllContacts();
});

function keepInTouchBlock(page: Page) {
  return page.getByRole("region", { name: "Пора связаться" });
}

function blockRows(page: Page) {
  return keepInTouchBlock(page).getByRole("listitem");
}

function blockRow(page: Page, name: string) {
  return blockRows(page).filter({ hasText: name });
}

// A contact in the general list, below the block: each letter is a section named "На букву …"
function listLink(page: Page, name: string) {
  return page.getByRole("region", { name: /^На букву/ }).getByRole("link", { name });
}

// The value of the "Как часто общаться" row in the contact card
function termRow(page: Page) {
  return page
    .getByRole("term")
    .filter({ hasText: "Как часто общаться" })
    .locator("xpath=following-sibling::dd[1]");
}

function checkMark(page: Page) {
  return page.getByRole("button", { name: /Пообщались/ });
}

// Notes of the contact card, newest first: each one starts with its date
function cardNotes(page: Page) {
  return page.getByRole("listitem").filter({ has: page.locator("time") });
}

function radio(page: Page, label: string) {
  return page.getByRole("radio", { name: label, exact: true });
}

async function openEditForm(page: Page) {
  await page.getByRole("link", { name: "Изменить" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Изменить контакт" })).toBeVisible();
}

async function saveEditForm(page: Page, name: string) {
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

// Adds a contact through the form and opens its card from the list
async function addContact(page: Page, name: string, chooseFrequency?: () => Promise<void>) {
  await page.goto("/contacts/new");
  await page.getByLabel("Имя и фамилия").fill(name);
  await chooseFrequency?.();
  await page.getByRole("button", { name: "Добавить контакт" }).click();
  await expect(page.getByText(`Контакт «${name}» добавлен`)).toBeVisible();
  await listLink(page, name).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

test("frequency in the forms: an old contact, adding with and without a frequency, changing it", async ({
  page,
}) => {
  await test.step("contacts added before the feature: «not set», other fields and notes are as they were", async () => {
    const id = await insertContact({
      name: "Олег Старый",
      phone: "+7 900 000-00-01",
      notes: [{ body: "Познакомились на конференции", createdAt: daysAgo(400) }],
    });
    await page.goto(`/contacts/${id}`);

    // Also the scenarios "Частота не задана" of the card and of the check mark
    await expect(termRow(page)).toHaveText("Не указано");
    await expect(checkMark(page)).toHaveCount(0);
    await expect(page.getByRole("link", { name: "+7 900 000-00-01" })).toBeVisible();
    await expect(cardNotes(page)).toHaveCount(1);
    await expect(cardNotes(page).first()).toContainText("Познакомились на конференции");

    await openEditForm(page);
    await expect(radio(page, "Не задано")).toBeChecked();
    await expect(page.getByLabel("Телефон")).toHaveValue("+7 900 000-00-01");
  });

  await test.step("frequency not chosen: the contact is saved with «not set»", async () => {
    await addContact(page, "Нина Новая");
    await expect(termRow(page)).toHaveText("Не указано");
  });

  await test.step("frequency when adding a contact: «Раз в месяц» counts from now", async () => {
    await addContact(page, "Пётр Месячный", () => radio(page, "Раз в месяц").click());
    await expect(termRow(page)).toContainText(
      `Раз в месяц · связаться до ${dueDateText(addMonths(today(), 1))}`,
    );
  });

  await test.step("changing the frequency in the edit form", async () => {
    await openEditForm(page);
    await expect(radio(page, "Раз в месяц")).toBeChecked();
    await radio(page, "Раз в неделю").click();
    await saveEditForm(page, "Пётр Месячный");
    await expect(termRow(page)).toContainText(
      `Раз в неделю · связаться до ${dueDateText(addDays(today(), 7))}`,
    );

    await openEditForm(page);
    await expect(radio(page, "Раз в неделю")).toBeChecked();
  });
});

test("custom term in the forms: wrong numbers of days, 10 days, 7 days", async ({ page }) => {
  const name = "Роман Свой Срок";
  const phone = "+7 900 000-00-04";

  await test.step("wrong number of days: an error under the field, nothing saved, the data stays", async () => {
    for (const days of ["", "0", "400", "2,5"]) {
      await page.goto("/contacts/new");
      await page.getByLabel("Имя и фамилия").fill(name);
      await page.getByLabel("Телефон").fill(phone);
      await radio(page, "Свой срок").click();
      await page.getByLabel("Число дней").fill(days);
      await page.getByRole("button", { name: "Добавить контакт" }).click();

      await expect(page.getByText("Укажите число дней от 1 до 365")).toBeVisible();
      await expect(page).toHaveURL(/\/contacts\/new$/);
      await expect(page.getByLabel("Имя и фамилия")).toHaveValue(name);
      await expect(page.getByLabel("Телефон")).toHaveValue(phone);
      await expect(radio(page, "Свой срок")).toBeChecked();
    }
    expect(await countContacts()).toBe(0);
  });

  await test.step("custom term of 10 days", async () => {
    await page.getByLabel("Число дней").fill("10");
    await page.getByRole("button", { name: "Добавить контакт" }).click();
    await expect(page.getByText(`Контакт «${name}» добавлен`)).toBeVisible();
    await listLink(page, name).click();
    await expect(termRow(page)).toContainText(
      `Раз в 10 дней · связаться до ${dueDateText(addDays(today(), 10))}`,
    );
  });

  await test.step("custom term in the edit form", async () => {
    await openEditForm(page);
    await expect(radio(page, "Свой срок")).toBeChecked();
    await expect(page.getByLabel("Число дней")).toHaveValue("10");
  });

  await test.step("seven days is not a week", async () => {
    await page.getByLabel("Число дней").fill("7");
    await saveEditForm(page, name);
    await expect(termRow(page)).toContainText("Раз в 7 дней ·");

    await openEditForm(page);
    await expect(radio(page, "Свой срок")).toBeChecked();
    await expect(page.getByLabel("Число дней")).toHaveValue("7");
  });
});

test("keep-in-touch block: who is in it, in which order, search, the card, removing the frequency", async ({
  page,
}) => {
  await test.step("no overdue contacts: no block", async () => {
    await insertContact({ name: "Глеб Не Просрочен", frequency: "month", since: today() });
    await insertContact({
      name: "Дарья Без Частоты",
      notes: [{ body: "Виделись год назад", createdAt: daysAgo(365) }],
    });
    await page.goto("/");
    await expect(listLink(page, "Глеб Не Просрочен")).toBeVisible();
    await expect(keepInTouchBlock(page)).toHaveCount(0);
  });

  await test.step("overdue contacts: the block with its title, number and rows, most overdue first", async () => {
    // "Раз в неделю": due 7 days after the start, so the start 7 + N days ago is N days overdue
    await insertContact({ name: "Анна Смирнова", frequency: "week", since: daysAgo(8) });
    await insertContact({ name: "Борис Ковалёв", frequency: "week", since: daysAgo(10) });
    await insertContact({
      name: "Вера Лебедева",
      frequency: "week",
      since: daysAgo(100),
      notes: [{ body: "Поздравила с днём рождения", createdAt: daysAgo(52) }],
    });
    await page.reload();

    const block = keepInTouchBlock(page);
    const title = block.getByText("пора связаться.exe");
    await expect(title).toBeVisible();
    await expect(title.locator("..")).toHaveCSS("background-color", ACCENT_PINK);
    await expect(block.getByText("3", { exact: true })).toBeVisible();

    // Also the scenarios "Склонение дней" and "Разная просрочка"
    await expect(blockRows(page)).toHaveText([
      /Вера Лебедева.*Раз в неделю · просрочено на 45 дней/,
      /Борис Ковалёв.*Раз в неделю · просрочено на 3 дня/,
      /Анна Смирнова.*Раз в неделю · просрочено на 1 день/,
    ]);
    for (const overdue of [
      "просрочено на 45 дней",
      "просрочено на 3 дня",
      "просрочено на 1 день",
    ]) {
      await expect(block.getByText(overdue, { exact: true })).toHaveCSS("color", DANGER_RED);
    }
    for (const name of ["Вера Лебедева", "Борис Ковалёв", "Анна Смирнова"]) {
      await expect(
        blockRow(page, name).getByRole("button", { name: `Пообщались: ${name}` }),
      ).toBeVisible();
    }
  });

  await test.step("searching: no block, only the search results", async () => {
    await page.getByRole("searchbox", { name: "Найти контакт по имени" }).fill("Борис");
    await expect(page).toHaveURL(/\?q=/);
    await expect(keepInTouchBlock(page)).toHaveCount(0);
    await expect(page.getByRole("region", { name: /^На букву/ }).getByRole("listitem")).toHaveCount(
      1,
    );
  });

  await test.step("search cleared: the block is back above the list", async () => {
    await page.getByRole("searchbox", { name: "Найти контакт по имени" }).fill("");
    await expect(page).not.toHaveURL(/\?q=/);
    await expect(blockRows(page)).toHaveCount(3);
  });

  await test.step("a row opens the card, where the term is overdue in red", async () => {
    await blockRow(page, "Борис Ковалёв").getByRole("link").click();
    await expect(page.getByRole("heading", { level: 1, name: "Борис Ковалёв" })).toBeVisible();
    await expect(termRow(page)).toContainText("Раз в неделю · пора связаться, просрочено на 3 дня");
    await expect(
      termRow(page).getByText("пора связаться, просрочено на 3 дня", { exact: true }),
    ).toHaveCSS("color", DANGER_RED);
  });

  await test.step("frequency removed: the contact leaves the block", async () => {
    await openEditForm(page);
    await radio(page, "Не задано").click();
    await saveEditForm(page, "Борис Ковалёв");
    await expect(termRow(page)).toHaveText("Не указано");

    await page.getByRole("link", { name: "Все контакты" }).click();
    await expect(blockRows(page)).toHaveCount(2);
    await expect(blockRow(page, "Борис Ковалёв")).toHaveCount(0);
  });
});

test("a note to an overdue contact starts the term again", async ({ page }) => {
  const id = await insertContact({ name: "Ирина Захарова", frequency: "week", since: daysAgo(10) });
  // Stays overdue, so the block is still there when Ирина leaves it
  await insertContact({ name: "Кирилл Соколов", frequency: "week", since: daysAgo(9) });

  await test.step("a note updates the term in the card at once, without reloading the page", async () => {
    await page.goto(`/contacts/${id}`);
    await expect(termRow(page)).toContainText("пора связаться, просрочено на 3 дня");

    await page.getByLabel("Новая заметка").fill("Созвонились, всё хорошо");
    await page.getByRole("button", { name: "Добавить заметку" }).click();
    await expect(page.getByText("Заметка сохранена")).toBeVisible();
    await expect(termRow(page)).toContainText(
      `Раз в неделю · связаться до ${dueDateText(addDays(today(), 7))}`,
    );
  });

  await test.step("after the note the contact is not in the block", async () => {
    await page.getByRole("link", { name: "Все контакты" }).click();
    await expect(blockRow(page, "Кирилл Соколов")).toBeVisible();
    await expect(blockRow(page, "Ирина Захарова")).toHaveCount(0);
  });
});

test("«Пообщались» check mark in the block: the toast, undo, the toast gone", async ({ page }) => {
  const name = "Мария Кузнецова";
  await insertContact({
    name,
    frequency: "week",
    since: daysAgo(30),
    notes: [{ body: "Обсудили поездку", createdAt: daysAgo(12) }],
  });
  // Stays overdue, so the block is still there when Мария leaves it
  await insertContact({ name: "Кирилл Соколов", frequency: "week", since: daysAgo(9) });
  const toast = page.getByText(`${name}: отмечено «Пообщались»`);

  await test.step("check mark in the block: the card does not open, Мария leaves the block, a toast with undo", async () => {
    await page.goto("/");
    await expect(blockRow(page, name)).toContainText("просрочено на 5 дней");
    await blockRow(page, name)
      .getByRole("button", { name: `Пообщались: ${name}` })
      .click();

    await expect(toast).toBeVisible();
    await expect(page.getByRole("button", { name: "Отменить" })).toBeVisible();
    const box = await toast.boundingBox();
    expect(box!.y).toBeGreaterThan(page.viewportSize()!.height / 2);
    await expect(page).toHaveURL(/\/$/);
    await expect(blockRow(page, name)).toHaveCount(0);
    await expect(blockRow(page, "Кирилл Соколов")).toBeVisible();
  });

  await test.step("undo: no «Пообщались» note, Мария is back with the same overdue, other notes stay", async () => {
    await page.getByRole("button", { name: "Отменить" }).click();
    await expect(page.getByText("Отметка отменена")).toBeVisible();
    await expect(blockRow(page, name)).toContainText("просрочено на 5 дней");

    await blockRow(page, name).getByRole("link").click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(cardNotes(page)).toHaveCount(1);
    await expect(cardNotes(page).first()).toContainText("Обсудили поездку");
  });

  await test.step("the toast is gone without undo: «Пообщались» stays first in the card with today's date", async () => {
    await page.getByRole("link", { name: "Все контакты" }).click();
    await blockRow(page, name)
      .getByRole("button", { name: `Пообщались: ${name}` })
      .click();
    await expect(toast).toBeVisible();
    // The toast lasts about 5 seconds
    await expect(toast).toBeHidden({ timeout: 10_000 });
    await expect(blockRow(page, name)).toHaveCount(0);

    await listLink(page, name).click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(cardNotes(page)).toHaveCount(2);
    await expect(cardNotes(page).first()).toContainText("Пообщались");
    await expect(cardNotes(page).first().locator("time")).toContainText(noteDayText(today()));
  });
});

test("«Пообщались» check mark in the card: an overdue contact and one that is not", async ({
  page,
}) => {
  await test.step("check mark in the card of an overdue contact: the note and the new due date at once", async () => {
    const id = await insertContact({ name: "Олег Петров", frequency: "week", since: daysAgo(12) });
    await page.goto(`/contacts/${id}`);
    await expect(termRow(page)).toContainText("пора связаться, просрочено на 5 дней");

    await checkMark(page).click();
    await expect(page.getByText("Олег Петров: отмечено «Пообщались»")).toBeVisible();
    await expect(cardNotes(page).first()).toContainText("Пообщались");
    await expect(termRow(page)).toContainText(
      `Раз в неделю · связаться до ${dueDateText(addDays(today(), 7))}`,
    );
  });

  await test.step("check mark for a contact that is not overdue: the due date moves to today + a month", async () => {
    const since = daysAgo(10);
    const id = await insertContact({ name: "Светлана Орлова", frequency: "month", since });
    await page.goto(`/contacts/${id}`);
    await expect(termRow(page)).toContainText(
      `Раз в месяц · связаться до ${dueDateText(addMonths(since, 1))}`,
    );

    await checkMark(page).click();
    await expect(cardNotes(page).first()).toContainText("Пообщались");
    await expect(termRow(page)).toContainText(
      `Раз в месяц · связаться до ${dueDateText(addMonths(today(), 1))}`,
    );
  });
});

test("start of the term of a contact without notes when the form is saved", async ({ page }) => {
  await test.step("saving the form without changing the frequency keeps the start of the term", async () => {
    const since = daysAgo(10);
    const id = await insertContact({
      name: "Тимур Ахметов",
      phone: "+7 900 000-00-02",
      frequency: "month",
      since,
    });
    await page.goto(`/contacts/${id}`);
    const dueText = `Раз в месяц · связаться до ${dueDateText(addMonths(since, 1))}`;
    await expect(termRow(page)).toContainText(dueText);

    await openEditForm(page);
    await page.getByLabel("Телефон").fill("+7 900 000-00-03");
    await saveEditForm(page, "Тимур Ахметов");
    await expect(page.getByRole("link", { name: "+7 900 000-00-03" })).toBeVisible();
    await expect(termRow(page)).toContainText(dueText);
  });

  await test.step("changing the frequency starts the term from the change", async () => {
    await openEditForm(page);
    await radio(page, "Раз в неделю").click();
    await saveEditForm(page, "Тимур Ахметов");
    await expect(termRow(page)).toContainText(
      `Раз в неделю · связаться до ${dueDateText(addDays(today(), 7))}`,
    );
  });

  await test.step("changing the number of days of a custom term starts the term from the change", async () => {
    const since = daysAgo(4);
    const id = await insertContact({ name: "Ульяна Белова", frequency: "days", days: 10, since });
    await page.goto(`/contacts/${id}`);
    await expect(termRow(page)).toContainText(
      `Раз в 10 дней · связаться до ${dueDateText(addDays(since, 10))}`,
    );

    await openEditForm(page);
    await page.getByLabel("Число дней").fill("14");
    await saveEditForm(page, "Ульяна Белова");
    await expect(termRow(page)).toContainText(
      `Раз в 14 дней · связаться до ${dueDateText(addDays(today(), 14))}`,
    );
  });
});
