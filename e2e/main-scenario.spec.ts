// Main scenario from specs/01-продуктовая-идея.md:
// open -> the list shows all contacts; add a contact -> it is in the list;
// find it by name -> open the card -> write a note -> the note is saved in the card;
// the same address in another browser -> the same contacts and the note.

import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { countContacts, insertContacts } from "./test-database";

// Rows of the contact list: each letter is a section named "На букву …"
function contactRows(page: Page) {
  return page.getByRole("region", { name: /^На букву/ }).getByRole("listitem");
}

function contactLink(page: Page, name: string) {
  return page.getByRole("link", { name });
}

test("main scenario: see all contacts, add one, find it, write a note, open in another browser", async ({
  page,
  browser,
  baseURL,
}) => {
  // A unique mark in every name: data of other tests never gets in the way
  const mark = randomUUID().slice(0, 6);
  const knownNames = [`Борис Ковалёв ${mark}`, `Вера Лебедева ${mark}`];
  const newName = `Алиса Морозова ${mark}`;
  const noteText = `Договорились созвониться в пятницу ${mark}`;
  await insertContacts(knownNames);

  await test.step("open the app: the list shows all contacts", async () => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Контакты" })).toBeVisible();
    await expect(contactRows(page)).toHaveCount(await countContacts());
    for (const name of knownNames) {
      await expect(contactLink(page, name)).toBeVisible();
    }
  });

  await test.step("add a contact: it appears in the list", async () => {
    await page.getByRole("link", { name: "Добавить контакт" }).click();
    await page.getByLabel("Имя и фамилия").fill(newName);
    await page.getByRole("button", { name: "Добавить контакт" }).click();

    await expect(page.getByText(`Контакт «${newName}» добавлен`)).toBeVisible();
    await expect(contactLink(page, newName)).toBeVisible();
  });

  let cardUrl = "";
  await test.step("find the contact by name and write a note in the card", async () => {
    await page.getByRole("searchbox", { name: "Найти контакт по имени" }).fill(newName);
    await expect(contactRows(page)).toHaveCount(1);
    await contactLink(page, newName).click();

    await expect(page.getByRole("heading", { level: 1, name: newName })).toBeVisible();
    cardUrl = page.url();
    await page.getByLabel("Новая заметка").fill(noteText);
    await page.getByRole("button", { name: "Добавить заметку" }).click();

    await expect(page.getByText("Заметка сохранена")).toBeVisible();
    await expect(page.getByText(noteText)).toBeVisible();
  });

  await test.step("reload the card: the note is still there", async () => {
    await page.reload();
    await expect(page.getByText(noteText)).toBeVisible();
  });

  await test.step("open the same address in another browser: the same contacts and the note", async () => {
    // A new context is a clean browser: no cookies, no storage, nothing shared with the first one
    const otherBrowser = await browser.newContext({ baseURL });
    try {
      const otherPage = await otherBrowser.newPage();

      await otherPage.goto("/");
      await expect(contactRows(otherPage)).toHaveCount(await countContacts());
      for (const name of [...knownNames, newName]) {
        await expect(contactLink(otherPage, name)).toBeVisible();
      }

      await otherPage.goto(cardUrl);
      await expect(otherPage.getByRole("heading", { level: 1, name: newName })).toBeVisible();
      await expect(otherPage.getByText(noteText)).toBeVisible();
    } finally {
      await otherBrowser.close();
    }
  });
});
