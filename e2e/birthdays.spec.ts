// Scenarios from openspec/changes/birthdays/specs/birthdays/spec.md, walked through in the browser:
// each test is a user path, each step is a scenario of the spec and is named after it.
// The date rules themselves (the nearest birthday, 29 February, the New Year, the age declension,
// a date in the future) are checked by the unit tests in src/lib: the browser cannot pick today's
// date in the form, so here the birthdays are counted from today with the helpers of dates.ts.

import { type Page } from "@playwright/test";

import {
  ageText,
  ageToday,
  birthdayInDays,
  birthdayText,
  daysAgo,
  daysUntilText,
  today,
  type BirthdaySeed,
} from "./dates";
import { expect, test } from "./fixtures";
import { countContacts, insertContact, insertGroup } from "./test-database";

// Color of the design token --color-butter in src/styles/tokens.css, as the browser reports it
const BUTTER = "rgb(255, 244, 176)";

// The three parts of the "Дата рождения" field
function dayInput(page: Page) {
  return page.getByRole("textbox", { name: "День", exact: true });
}

function monthSelect(page: Page) {
  return page.getByRole("combobox", { name: "Месяц", exact: true });
}

function yearInput(page: Page) {
  return page.getByRole("textbox", { name: "Год", exact: true });
}

function birthdayField(page: Page) {
  return page.getByRole("group", { name: "Дата рождения" });
}

type Typed = { day?: string; month?: string; year?: string };

// Types the parts into the form; a part that is not given is left as it is, "" empties it
async function fillBirthday(page: Page, { day, month, year }: Typed) {
  if (day !== undefined) await dayInput(page).fill(day);
  if (month !== undefined) {
    await monthSelect(page).selectOption(month === "" ? { value: "" } : { label: month });
  }
  if (year !== undefined) await yearInput(page).fill(year);
}

// The value of the "Дата рождения" row in the contact card
function cardRow(page: Page) {
  return page
    .getByRole("term")
    .filter({ hasText: "Дата рождения" })
    .locator("xpath=following-sibling::dd[1]");
}

// A contact in the general list: each letter is a section named "На букву …"
function listLink(page: Page, name: string) {
  return page.getByRole("region", { name: /^На букву/ }).getByRole("link", { name });
}

async function openEditForm(page: Page) {
  await page.getByRole("link", { name: "Изменить" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Изменить контакт" })).toBeVisible();
}

async function saveEditForm(page: Page, name: string) {
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

async function submitNewContact(page: Page) {
  await page.getByRole("button", { name: "Добавить контакт" }).click();
}

// Adds a contact through the form and opens its card from the list
async function addContact(page: Page, name: string, birthday: Typed = {}) {
  await page.goto("/contacts/new");
  await page.getByLabel("Имя и фамилия").fill(name);
  await fillBirthday(page, birthday);
  await submitNewContact(page);
  await expect(page.getByText(`Контакт «${name}» добавлен`)).toBeVisible();
  await listLink(page, name).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

// What the card says about a birthday with a year: "25 ноября 1990 · 35 лет"
function cardText(birthday: BirthdaySeed & { year: number }) {
  return `${birthdayText(birthday)} · ${ageText(ageToday(birthday))}`;
}

test("birthday in the forms: adding, an old contact, changing and removing the date", async ({
  page,
}) => {
  await test.step("«Дата с годом»: 25 ноября 1990 shows in the card", async () => {
    await addContact(page, "Анна Смирнова", { day: "25", month: "ноября", year: "1990" });
    await expect(cardRow(page)).toContainText("25 ноября 1990");
    await expect(cardRow(page)).toHaveText(cardText({ day: 25, month: 11, year: 1990 }));
  });

  await test.step("«Дата без года»: 25 ноября without the year and the age", async () => {
    await addContact(page, "Борис Без Года", { day: "25", month: "ноября" });
    await expect(cardRow(page)).toHaveText("25 ноября");
  });

  await test.step("«Дату не указали»: the contact is saved, the card says «Не указано»", async () => {
    await addContact(page, "Вера Без Даты");
    await expect(cardRow(page)).toHaveText("Не указано");
  });

  await test.step("«Контакты, добавленные до этой фичи»: «Не указано», empty form, other fields as they were", async () => {
    const id = await insertContact({ name: "Олег Старый", phone: "+7 900 111-22-33" });
    await page.goto(`/contacts/${id}`);
    await expect(cardRow(page)).toHaveText("Не указано");
    await expect(page.getByRole("link", { name: "+7 900 111-22-33" })).toBeVisible();

    await openEditForm(page);
    await expect(dayInput(page)).toHaveValue("");
    await expect(monthSelect(page)).toHaveValue("");
    await expect(yearInput(page)).toHaveValue("");
    await expect(page.getByLabel("Имя и фамилия")).toHaveValue("Олег Старый");
    await expect(page.getByLabel("Телефон")).toHaveValue("+7 900 111-22-33");
  });

  await test.step("«Дата в форме «Изменить»»: day 25, month «ноября», year 1990", async () => {
    await page.goto("/");
    await listLink(page, "Анна Смирнова").click();
    await openEditForm(page);
    await expect(birthdayField(page)).toBeVisible();
    await expect(dayInput(page)).toHaveValue("25");
    await expect(monthSelect(page).locator("option:checked")).toHaveText("ноября");
    await expect(yearInput(page)).toHaveValue("1990");
  });

  await test.step("«Сменили дату»: 3 марта 1990 shows in the card", async () => {
    await fillBirthday(page, { day: "3", month: "марта" });
    await saveEditForm(page, "Анна Смирнова");
    await expect(cardRow(page)).toHaveText(cardText({ day: 3, month: 3, year: 1990 }));
  });

  await test.step("«Убрали дату»: the card says «Не указано»", async () => {
    await openEditForm(page);
    await fillBirthday(page, { day: "", month: "", year: "" });
    await saveEditForm(page, "Анна Смирнова");
    await expect(cardRow(page)).toHaveText("Не указано");
  });
});

test("birthday is checked by the server: errors show under the field, nothing is saved", async ({
  page,
}) => {
  const thisYear = today().getFullYear();
  let saved = await countContacts();

  async function expectRefused(typed: Typed, message: string) {
    await fillBirthday(page, typed);
    await submitNewContact(page);
    // The error is under the three parts, all of them are marked, and what was typed stays
    await expect(birthdayField(page).getByText(message, { exact: true })).toBeVisible();
    await expect(dayInput(page)).toHaveAttribute("aria-invalid", "true");
    await expect(monthSelect(page)).toHaveAttribute("aria-invalid", "true");
    await expect(yearInput(page)).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Имя и фамилия")).toHaveValue("Проверка Даты");
    await expect(page).toHaveURL(/\/contacts\/new$/);
    expect(await countContacts()).toBe(saved);
  }

  async function resetBirthday(page: Page) {
    await fillBirthday(page, { day: "", month: "", year: "" });
  }

  await page.goto("/contacts/new");
  await page.getByLabel("Имя и фамилия").fill("Проверка Даты");

  await test.step("«Не хватает дня или месяца»: only the month, only the day, only the year", async () => {
    await expectRefused({ month: "ноября" }, "Укажите день и месяц");
    await resetBirthday(page);
    await expectRefused({ day: "25" }, "Укажите день и месяц");
    await resetBirthday(page);
    await expectRefused({ year: "1990" }, "Укажите день и месяц");
    await resetBirthday(page);
  });

  await test.step("«Такой даты нет»: 31 апреля, day 0, 32 and 2,5 of «ноября»", async () => {
    await expectRefused({ day: "31", month: "апреля" }, "Такой даты нет");
    for (const day of ["0", "32", "2,5"]) {
      await resetBirthday(page);
      await expectRefused({ day, month: "ноября" }, "Такой даты нет");
    }
    await resetBirthday(page);
  });

  await test.step("«29 февраля с годом»: 2001 is refused", async () => {
    await expectRefused({ day: "29", month: "февраля", year: "2001" }, "Такой даты нет");
    await resetBirthday(page);
  });

  await test.step("«Неверный год»: 1899, next year, 90 and 19а0", async () => {
    const message = `Укажите год от 1900 до ${thisYear}`;
    for (const year of ["1899", String(thisYear + 1), "90", "19а0"]) {
      await resetBirthday(page);
      await expectRefused({ day: "25", month: "ноября", year }, message);
    }
    await resetBirthday(page);
  });

  await test.step("«29 февраля с годом»: 2000 is saved as «29 февраля 2000»", async () => {
    await fillBirthday(page, { day: "29", month: "февраля", year: "2000" });
    await submitNewContact(page);
    await expect(page.getByText("Контакт «Проверка Даты» добавлен")).toBeVisible();
    saved += 1;
    expect(await countContacts()).toBe(saved);
    await listLink(page, "Проверка Даты").click();
    await expect(cardRow(page)).toContainText("29 февраля 2000");
  });

  await test.step("«29 февраля без года»: saved as «29 февраля»", async () => {
    await addContact(page, "Двадцать Девятое", { day: "29", month: "февраля" });
    await expect(cardRow(page)).toHaveText("29 февраля");
  });
});

test("birthday in the card: with a year, on the birthday, without a year, no date", async ({
  page,
}) => {
  await test.step("«Дата с годом»: the date and the age today", async () => {
    const birthday = { day: 25, month: 11, year: 1990 };
    const id = await insertContact({ name: "Анна С Годом", birthday });
    await page.goto(`/contacts/${id}`);
    await expect(cardRow(page)).toHaveText(cardText(birthday));
  });

  await test.step("«В день рождения»: the new age already", async () => {
    const { birthday, turning } = birthdayInDays(0, 36);
    const id = await insertContact({ name: "Борис Сегодня", birthday });
    await page.goto(`/contacts/${id}`);
    // On 29 February the year of birth moves to a leap year, so the age is whatever the helper says
    await expect(cardRow(page)).toHaveText(`${birthdayText(birthday)} · ${ageText(turning ?? 0)}`);
  });

  await test.step("«Дата без года»: only the day and the month, no age", async () => {
    const id = await insertContact({
      name: "Вера Без Года",
      birthday: { day: 25, month: 11, year: null },
    });
    await page.goto(`/contacts/${id}`);
    await expect(cardRow(page)).toHaveText("25 ноября");
  });

  await test.step("«Даты нет»: «Не указано»", async () => {
    const id = await insertContact({ name: "Глеб Без Даты" });
    await page.goto(`/contacts/${id}`);
    await expect(cardRow(page)).toHaveText("Не указано");
  });
});

test("birthday field on a phone: the three parts stay in one row and the page does not scroll sideways", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/contacts/new");
  // The widest month name, so the list is as tight as it gets
  await fillBirthday(page, { day: "30", month: "сентября", year: "1990" });

  const boxes = await Promise.all(
    [dayInput(page), monthSelect(page), yearInput(page)].map((part) => part.boundingBox()),
  );
  const [day, month, year] = boxes;
  expect(day && month && year).toBeTruthy();
  if (!day || !month || !year) return;
  // One row: the tops are the same, and the parts do not overlap
  expect(Math.abs(day.y - month.y)).toBeLessThan(2);
  expect(Math.abs(month.y - year.y)).toBeLessThan(2);
  expect(day.x + day.width).toBeLessThanOrEqual(month.x);
  expect(month.x + month.width).toBeLessThanOrEqual(year.x);
  expect(year.x + year.width).toBeLessThanOrEqual(360);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  // For a look by eye: the year is empty here, so its hint is visible
  await yearInput(page).fill("");
  await page.screenshot({ path: testInfo.outputPath("birthday-field-360.png") });
});

function birthdaysBlock(page: Page) {
  return page.getByRole("region", { name: "Скоро день рождения" });
}

function birthdayRows(page: Page) {
  return birthdaysBlock(page).getByRole("listitem");
}

function birthdayRow(page: Page, name: string) {
  return birthdayRows(page).filter({ hasText: name });
}

// Puts a contact with a birthday `days` from today into the database and returns the text the block
// row must show under the name: "25 ноября · через 7 дней · исполнится 36" (no age without a year)
async function addBirthdayContact(name: string, days: number, turning?: number) {
  const next = birthdayInDays(days, turning);
  await insertContact({ name, birthday: next.birthday });
  const parts = [
    birthdayText({ ...next.birthday, year: null }),
    daysUntilText(days),
    ...(next.turning === null ? [] : [`исполнится ${next.turning}`]),
  ];
  return parts.join(" · ");
}

test("birthdays block: who is in it, the rows, the order, the card, the date set and removed, search and filter", async ({
  page,
}) => {
  await test.step("«Дней рождения на неделе нет», «Границы недели», «Контакт без даты рождения»: no block", async () => {
    // Yesterday and in 8 days are just outside the week
    await addBirthdayContact("Игорь Вчера", -1, 30);
    await addBirthdayContact("Кира Через Восемь", 8, 30);
    await insertContact({ name: "Лев Без Даты" });
    await page.goto("/");
    await expect(listLink(page, "Лев Без Даты")).toBeVisible();
    await expect(birthdaysBlock(page)).toHaveCount(0);
  });

  await test.step("«Есть дни рождения на этой неделе»: yellow title bar, title, number and two rows", async () => {
    await addBirthdayContact("Борис Ровно", 3, 40);
    await addBirthdayContact("Алла Ровно", 3);
    await page.reload();

    const block = birthdaysBlock(page);
    const title = block.getByText("скоро день рождения.exe");
    await expect(title).toBeVisible();
    await expect(title.locator("..")).toHaveCSS("background-color", BUTTER);
    await expect(block.getByText("2", { exact: true })).toBeVisible();
    await expect(birthdayRows(page)).toHaveCount(2);
    // «Контакт без даты рождения» and the edges of the week stay out
    for (const name of ["Лев Без Даты", "Игорь Вчера", "Кира Через Восемь"]) {
      await expect(birthdayRow(page, name)).toHaveCount(0);
    }
  });

  await test.step("«Один день»: the same day, alphabetical order", async () => {
    // «Борис» was added first, but «Алла» comes first in the alphabet
    await expect(birthdayRows(page)).toHaveText([/Алла Ровно/, /Борис Ровно/]);
  });

  const details = new Map<string, string>();
  await test.step("the rest of the week is added", async () => {
    details.set("Вера Сегодня", await addBirthdayContact("Вера Сегодня", 0, 36));
    details.set("Глеб Завтра", await addBirthdayContact("Глеб Завтра", 1, 41));
    details.set("Дина Через Два", await addBirthdayContact("Дина Через Два", 2));
    details.set("Егор Через Четыре", await addBirthdayContact("Егор Через Четыре", 4, 25));
    details.set("Жанна Через Пять", await addBirthdayContact("Жанна Через Пять", 5));
    details.set("Зоя Через Семь", await addBirthdayContact("Зоя Через Семь", 7, 30));
    await page.reload();
  });

  await test.step("«Разные дни»: the nearest birthday is the highest", async () => {
    await expect(birthdayRows(page)).toHaveText([
      /Вера Сегодня/,
      /Глеб Завтра/,
      /Дина Через Два/,
      /Алла Ровно/,
      /Борис Ровно/,
      /Егор Через Четыре/,
      /Жанна Через Пять/,
      /Зоя Через Семь/,
    ]);
    await expect(birthdaysBlock(page).getByText("8", { exact: true })).toBeVisible();
  });

  await test.step("«Что в строке», «День рождения сегодня», «День рождения завтра», «Склонение дней»", async () => {
    // Today, tomorrow, 2 / 4 / 5 / 7 days: the words, the date and the age that is turning
    for (const [name, detail] of details) {
      await expect(birthdayRow(page, name).getByText(detail, { exact: true })).toBeVisible();
    }
    await expect(birthdayRow(page, "Вера Сегодня")).toContainText("сегодня");
    await expect(birthdayRow(page, "Глеб Завтра")).toContainText("завтра");
    await expect(birthdayRow(page, "Дина Через Два")).toContainText("через 2 дня");
    await expect(birthdayRow(page, "Егор Через Четыре")).toContainText("через 4 дня");
    await expect(birthdayRow(page, "Жанна Через Пять")).toContainText("через 5 дней");
  });

  await test.step("«Год не указан»: no «исполнится» in the row", async () => {
    await expect(birthdayRow(page, "Дина Через Два")).not.toContainText("исполнится");
    await expect(birthdayRow(page, "Жанна Через Пять")).not.toContainText("исполнится");
    await expect(birthdayRow(page, "Вера Сегодня")).toContainText("исполнится");
  });

  await test.step("«Выше блока «Пора связаться»»: birthdays, then overdue, then the list", async () => {
    await insertContact({ name: "Яна Просрочена", frequency: "week", since: daysAgo(10) });
    await page.reload();

    const keepInTouch = page.getByRole("region", { name: "Пора связаться" });
    await expect(keepInTouch).toBeVisible();
    const list = page.getByRole("region", { name: /^На букву/ }).first();
    const [birthdays, overdue, contacts] = await Promise.all([
      birthdaysBlock(page).boundingBox(),
      keepInTouch.boundingBox(),
      list.boundingBox(),
    ]);
    expect(birthdays && overdue && contacts).toBeTruthy();
    if (!birthdays || !overdue || !contacts) return;
    expect(birthdays.y + birthdays.height).toBeLessThanOrEqual(overdue.y);
    expect(overdue.y + overdue.height).toBeLessThanOrEqual(contacts.y);
  });

  await test.step("«Переход в карточку»: a row opens the card of the contact", async () => {
    await birthdayRow(page, "Вера Сегодня").getByRole("link").click();
    await expect(page.getByRole("heading", { level: 1, name: "Вера Сегодня" })).toBeVisible();
    await expect(page).toHaveURL(/\/contacts\/\d+$/);
  });

  await test.step("«Указали дату — контакт появился в блоке»: «Лев» gets a birthday in 3 days", async () => {
    await page.goto("/");
    await listLink(page, "Лев Без Даты").click();
    await openEditForm(page);
    const { birthday } = birthdayInDays(3);
    await dayInput(page).fill(String(birthday.day));
    await monthSelect(page).selectOption({ value: String(birthday.month) });
    await saveEditForm(page, "Лев Без Даты");

    await page.goto("/");
    await expect(birthdayRow(page, "Лев Без Даты")).toHaveCount(1);
  });

  await test.step("«Убрали дату»: «Алла» leaves the block", async () => {
    await expect(birthdayRow(page, "Алла Ровно")).toHaveCount(1);
    await listLink(page, "Алла Ровно").click();
    await openEditForm(page);
    await fillBirthday(page, { day: "", month: "", year: "" });
    await saveEditForm(page, "Алла Ровно");
    await expect(cardRow(page)).toHaveText("Не указано");

    await page.goto("/");
    await expect(birthdaysBlock(page)).toBeVisible();
    await expect(birthdayRow(page, "Алла Ровно")).toHaveCount(0);
  });

  await test.step("«Идёт поиск»: no block, only the search results", async () => {
    await page.getByRole("searchbox", { name: "Найти контакт по имени" }).fill("Борис");
    await expect(page).toHaveURL(/\?q=/);
    await expect(birthdaysBlock(page)).toHaveCount(0);
    await expect(page.getByRole("region", { name: /^На букву/ }).getByRole("listitem")).toHaveCount(
      1,
    );
  });

  await test.step("«Поиск очищен»: the block is back above the list", async () => {
    await page.getByRole("searchbox", { name: "Найти контакт по имени" }).fill("");
    await expect(page).not.toHaveURL(/\?q=/);
    await expect(birthdaysBlock(page)).toBeVisible();
  });

  await test.step("«Включён фильтр по группам»: no block", async () => {
    const group = await insertGroup("Друзья");
    await insertContact({ name: "Мила Из Группы", groupIds: [group] });
    await page.reload();
    await expect(birthdaysBlock(page)).toBeVisible();

    await page
      .getByRole("navigation", { name: "Группы" })
      .getByRole("link", { name: "Друзья" })
      .click();
    await expect(page).toHaveURL(/group=/);
    await expect(listLink(page, "Мила Из Группы")).toBeVisible();
    await expect(birthdaysBlock(page)).toHaveCount(0);
  });
});
