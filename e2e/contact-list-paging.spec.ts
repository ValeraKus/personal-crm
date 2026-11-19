// Scenarios of openspec/changes/paging/specs/contact-list-paging/spec.md, walked through in the
// browser: the list of contacts in parts of 100, the page switcher, the caption under it, the page
// in the address, the search and the groups with pages, the new contact's page, «Все контакты».
// Each test is a user path on contacts put into the database in one query (numberedNames,
// insertNumberedContacts); each step is a scenario of the spec and is named after it. The paths are
// few on purpose: every test signs in through the real form, and the login of the app lets only
// 100 requests a minute through for all the tests together (src/lib/auth.ts).
// The rules of the switcher and of the address are also checked by src/lib/paging.test.ts.

import { type Page } from "@playwright/test";

import { signIn } from "./auth";
import { expect, test } from "./fixtures";
import {
  actAs,
  insertContact,
  insertContacts,
  insertGroup,
  insertNumberedContacts,
  numberedNames,
} from "./test-database";

// Color of the design token --color-butter in src/styles/tokens.css, as the browser reports it
const BUTTER = "rgb(255, 244, 176)";

// Rows of the list: each letter is a section named "На букву …"
function letterSections(page: Page) {
  return page.getByRole("region", { name: /^На букву/ });
}

function contactRows(page: Page) {
  return letterSections(page).getByRole("listitem");
}

function pager(page: Page) {
  return page.getByRole("navigation", { name: "Страницы" });
}

// What the switcher shows now, e.g. "1 … 4 5 6 … 10". Only what is visible on this screen: the
// row for a computer or the row for a phone, never both.
async function switcherText(page: Page) {
  const texts = await pager(page).getByRole("listitem").allInnerTexts();
  return texts
    .map((text) => text.trim())
    .filter(Boolean)
    .join(" ");
}

// The numbers of the open pages: the ones the switcher marks as current
async function openPages(page: Page) {
  return pager(page)
    .getByRole("link", { name: /^Страница \d+$/ })
    .and(page.locator('[aria-current="page"]'))
    .allInnerTexts();
}

function caption(page: Page) {
  return page.getByText(/^Показан/);
}

function loadMore(page: Page) {
  return page.getByRole("link", { name: "Загрузить ещё" });
}

function groupButton(page: Page, name: string) {
  return page.getByRole("navigation", { name: "Группы" }).getByRole("link", { name });
}

function searchBox(page: Page) {
  return page.getByRole("searchbox", { name: "Найти контакт по имени" });
}

function backToList(page: Page) {
  return page.getByRole("link", { name: "Все контакты" });
}

// The query part of the address, e.g. "?page=2"
async function addressSearch(page: Page) {
  return new URL(page.url()).search;
}

// The page has no horizontal scroll: nothing is wider than the screen
async function fitsTheWidth(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
}

// Opens the card of the first contact of the list
async function openFirstCard(page: Page) {
  await contactRows(page).first().getByRole("link").click();
  await expect(page).toHaveURL(/\/contacts\/\d+$/);
}

// Adds a contact through the form, as a person does, and waits for the list to open
async function addContactThroughForm(page: Page, name: string) {
  await page.goto("/contacts/new");
  await page.getByLabel("Имя и фамилия").fill(name);
  await page.getByRole("button", { name: "Добавить контакт" }).click();
}

function addedToast(page: Page, name: string) {
  return page.getByText(`Контакт «${name}» добавлен`);
}

function rowLink(page: Page, name: string) {
  return contactRows(page).filter({ hasText: name }).getByRole("link");
}

test("250 contacts: the first page, the switcher, the caption, the counter, the address", async ({
  page,
  browser,
  baseURL,
  userEmail,
}) => {
  const names = await insertNumberedContacts(250);

  await test.step("«Больше 100 контактов»: first 100, the switcher «1 2 3» and the caption", async () => {
    await page.goto("/");

    await expect(contactRows(page)).toHaveCount(100);
    await expect(contactRows(page).first()).toContainText(names[0]);
    await expect(contactRows(page).last()).toContainText(names[99]);
    await expect.poll(() => switcherText(page)).toBe("1 2 3");
    await expect.poll(() => openPages(page)).toEqual(["1"]);
    await expect(caption(page)).toHaveText("Показаны 1–100 из 250");
    await expect(loadMore(page)).toBeVisible();
  });

  await test.step("«Счётчик считает все контакты»: 250 on every page", async () => {
    await expect(page.getByText("250 контактов", { exact: true })).toBeVisible();

    await page.goto("/?page=3");
    await expect(contactRows(page)).toHaveCount(50);
    await expect(page.getByText("250 контактов", { exact: true })).toBeVisible();
  });

  await test.step("«Переход на страницу»: contacts 101 to 200, opened from the top", async () => {
    await page.goto("/");
    await expect(contactRows(page)).toHaveCount(100);
    // The first page is scrolled down, as a person looks at its end before pressing a number
    await page.mouse.wheel(0, 3000);

    await pager(page).getByRole("link", { name: "Страница 2" }).click();

    await expect.poll(() => addressSearch(page)).toBe("?page=2");
    await expect.poll(() => openPages(page)).toEqual(["2"]);
    await expect(contactRows(page)).toHaveCount(100);
    await expect(contactRows(page).first()).toContainText(names[100]);
    await expect(contactRows(page).last()).toContainText(names[199]);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });

  await test.step("«Последняя страница», «Последняя неполная страница» в подписи: 201 to 250", async () => {
    await pager(page).getByRole("link", { name: "Страница 3" }).click();

    await expect.poll(() => openPages(page)).toEqual(["3"]);
    await expect(contactRows(page)).toHaveCount(50);
    await expect(contactRows(page).first()).toContainText(names[200]);
    await expect(contactRows(page).last()).toContainText(names[249]);
    await expect(pager(page).getByRole("link", { name: "Следующая страница" })).toBeDisabled();
    await expect(caption(page)).toHaveText("Показаны 201–250 из 250");
    await expect(loadMore(page)).toHaveCount(0);
  });

  await test.step("«Стрелки»: forward, then back twice", async () => {
    await page.goto("/?page=2");
    await expect.poll(() => openPages(page)).toEqual(["2"]);

    await pager(page).getByRole("link", { name: "Следующая страница" }).click();
    await expect.poll(() => openPages(page)).toEqual(["3"]);

    await pager(page).getByRole("link", { name: "Предыдущая страница" }).click();
    await expect.poll(() => openPages(page)).toEqual(["2"]);

    await pager(page).getByRole("link", { name: "Предыдущая страница" }).click();
    await expect.poll(() => openPages(page)).toEqual(["1"]);
    await expect(pager(page).getByRole("link", { name: "Предыдущая страница" })).toBeDisabled();
  });

  await test.step("«Страницы с таким номером нет»: the last page is open", async () => {
    await page.goto("/?page=99");

    await expect.poll(() => openPages(page)).toEqual(["3"]);
    await expect(contactRows(page)).toHaveCount(50);
    await expect(contactRows(page).first()).toContainText(names[200]);
  });

  await test.step("«Неверный номер страницы»: the first page is open", async () => {
    for (const wrong of ["abc", "0", "-1"]) {
      await page.goto(`/?page=${wrong}`);
      await expect.poll(() => openPages(page)).toEqual(["1"]);
      await expect(contactRows(page).first()).toContainText(names[0]);
    }
  });

  await test.step("«Обновил страницу»: the same page after a reload and in another browser", async () => {
    await page.goto("/?page=2");
    await expect(contactRows(page).first()).toContainText(names[100]);

    await page.reload();
    await expect.poll(() => openPages(page)).toEqual(["2"]);
    await expect(contactRows(page).first()).toContainText(names[100]);
    await expect(contactRows(page).last()).toContainText(names[199]);

    // Another browser is another device: it signs in under the same address
    const otherBrowser = await browser.newContext({ baseURL });
    try {
      const otherPage = await otherBrowser.newPage();
      await signIn(otherPage, userEmail);
      await otherPage.goto("/?page=2");
      await expect.poll(() => openPages(otherPage)).toEqual(["2"]);
      await expect(contactRows(otherPage).first()).toContainText(names[100]);
    } finally {
      await otherBrowser.close();
    }
  });
});

test("1000 contacts on a computer: many pages, loading more from the middle, a number after loading", async ({
  page,
}) => {
  const names = await insertNumberedContacts(1000);

  await test.step("«Много страниц»: 1 … 4 5 6 … 10", async () => {
    await page.goto("/?page=5");

    await expect.poll(() => switcherText(page)).toBe("1 … 4 5 6 … 10");
    await expect.poll(() => openPages(page)).toEqual(["5"]);
  });

  await test.step("«Подгрузил с середины»: 3 and 4 are open, the arrows lead to 2 and 5", async () => {
    await page.goto("/?page=3");

    await loadMore(page).click();

    await expect(contactRows(page)).toHaveCount(200);
    await expect(contactRows(page).first()).toContainText(names[200]);
    await expect(contactRows(page).last()).toContainText(names[399]);
    await expect.poll(() => openPages(page)).toEqual(["3", "4"]);
    await expect(pager(page).getByRole("link", { name: "Предыдущая страница" })).toHaveAttribute(
      "href",
      "/?page=2",
    );
    await expect(pager(page).getByRole("link", { name: "Следующая страница" })).toHaveAttribute(
      "href",
      "/?page=5",
    );
  });

  await test.step("«Подпись после «Загрузить ещё»»: the whole open piece", async () => {
    await expect(caption(page)).toHaveText(/^Показаны 201–400 из 1\s000$/);
  });

  await test.step("«Номер после подгрузки»: only that page is open", async () => {
    await page.goto("/");
    await loadMore(page).click();
    await expect(contactRows(page)).toHaveCount(200);

    await pager(page).getByRole("link", { name: "Страница 3" }).click();

    await expect.poll(() => openPages(page)).toEqual(["3"]);
    await expect(contactRows(page)).toHaveCount(100);
    await expect(contactRows(page).first()).toContainText(names[200]);
    await expect(contactRows(page).last()).toContainText(names[299]);
  });
});

test("1000 contacts on a phone: the switcher fits the width, many open pages wrap", async ({
  page,
}) => {
  await insertNumberedContacts(1000);
  await page.setViewportSize({ width: 375, height: 800 });

  await test.step("«Много страниц на телефоне»: 1 … 5 … 10 without a sideways scroll", async () => {
    await page.goto("/?page=5");

    await expect.poll(() => switcherText(page)).toBe("1 … 5 … 10");
    await expect(pager(page)).toBeVisible();
    await expect.poll(() => fitsTheWidth(page)).toBe(true);
  });

  await test.step("«Одна пропущенная страница на телефоне»: 1 2 3 … 10", async () => {
    await page.goto("/?page=3");

    // Page 2 is shown as a number, not hidden behind "…"
    await expect.poll(() => switcherText(page)).toBe("1 2 3 … 10");
  });

  await test.step("«Много открытых страниц на телефоне»: the numbers wrap to a second line", async () => {
    await page.goto("/");
    for (let opened = 2; opened <= 5; opened += 1) {
      await loadMore(page).click();
      await expect(contactRows(page)).toHaveCount(opened * 100);
    }

    await expect.poll(() => openPages(page)).toEqual(["1", "2", "3", "4", "5"]);
    // The numbers do not fit one line: the links stand on two lines at least
    const lines = new Set<number>();
    for (const link of await pager(page).getByRole("link").all()) {
      lines.add(Math.round((await link.boundingBox())!.y));
    }
    expect(lines.size).toBeGreaterThanOrEqual(2);
    await expect.poll(() => fitsTheWidth(page)).toBe(true);
  });
});

test("100 and 101 contacts: no switcher at 100, one contact on the second page at 101", async ({
  page,
}) => {
  await insertNumberedContacts(100);

  await test.step("«Ровно 100 контактов»: no switcher, no caption, no «Загрузить ещё»", async () => {
    await page.goto("/");

    await expect(contactRows(page)).toHaveCount(100);
    await expect(pager(page)).toHaveCount(0);
    await expect(caption(page)).toHaveCount(0);
    await expect(loadMore(page)).toHaveCount(0);
  });

  await test.step("«Один контакт на странице»: Показан 101-й из 101", async () => {
    await insertContacts(["Яна Яковлева"]);

    await page.goto("/?page=2");

    await expect(contactRows(page)).toHaveCount(1);
    await expect(caption(page)).toHaveText("Показан 101-й из 101");
  });
});

test("a letter that goes over the page border: the heading on the next page, not repeated on loading", async ({
  page,
}) => {
  // 60 names on «А» and 190 on «К»: the first page ends in the middle of «К»
  await insertContacts([...numberedNames(60, "Анна"), ...numberedNames(190)]);

  await test.step("«Буква продолжается на следующей странице»: the second page starts with its heading", async () => {
    await page.goto("/?page=2");

    await expect(letterSections(page)).toHaveCount(1);
    await expect(
      letterSections(page).getByRole("heading", { name: "К", exact: true }),
    ).toBeVisible();
    await expect(contactRows(page)).toHaveCount(100);
    await expect(contactRows(page).first()).toContainText("Контакт 041");
  });

  await test.step("«Буква не повторяется»: loaded contacts go under the same heading", async () => {
    await page.goto("/");
    await expect(letterSections(page)).toHaveCount(2);

    await loadMore(page).click();

    await expect(contactRows(page)).toHaveCount(200);
    await expect(letterSections(page)).toHaveCount(2);
    await expect(letterSections(page).getByRole("heading", { name: "К", exact: true })).toHaveCount(
      1,
    );
  });
});

test("a search with pages: the caption, the counter, the next page, a new query, back from a card", async ({
  page,
}) => {
  // 150 names with «ов» among 300
  const found = numberedNames(150, "Иванов");
  await insertContacts([...found, ...numberedNames(150, "Сидор")]);

  await test.step("«Подпись в поиске»: Показаны 101–150 из 150", async () => {
    await page.goto(`/?q=${encodeURIComponent("ов")}&page=2`);

    await expect(caption(page)).toHaveText("Показаны 101–150 из 150");
  });

  await test.step("«Много найдено»: the first 100 found, the counter and the switcher «1 2»", async () => {
    await page.goto("/");

    await searchBox(page).fill("ов");

    await expect(page.getByText("Найдено: 150 из 300 контактов")).toBeVisible();
    await expect(contactRows(page)).toHaveCount(100);
    await expect(contactRows(page).first()).toContainText(found[0]);
    await expect.poll(() => switcherText(page)).toBe("1 2");
  });

  await test.step("«Следующая страница поиска»: the rest of the found, the query stays", async () => {
    await pager(page).getByRole("link", { name: "Страница 2" }).click();

    await expect.poll(() => openPages(page)).toEqual(["2"]);
    await expect(searchBox(page)).toHaveValue("ов");
    await expect(contactRows(page)).toHaveCount(50);
    await expect(contactRows(page).first()).toContainText(found[100]);
    await expect(page.getByText("Сидор")).toHaveCount(0);
  });

  await test.step("«Из поиска»: «Все контакты» goes back to the second page of the same search", async () => {
    await openFirstCard(page);

    await backToList(page).click();

    await expect.poll(() => openPages(page)).toEqual(["2"]);
    await expect(searchBox(page)).toHaveValue("ов");
    await expect(contactRows(page)).toHaveCount(50);
  });

  await test.step("«Сменил запрос»: the first page of the new results", async () => {
    await page.goto("/?page=2");
    await expect.poll(() => openPages(page)).toEqual(["2"]);

    await searchBox(page).fill("ов");

    await expect(page.getByText("Найдено: 150 из 300 контактов")).toBeVisible();
    await expect.poll(() => openPages(page)).toEqual(["1"]);
    await expect(caption(page)).toHaveText("Показаны 1–100 из 150");
    expect(await addressSearch(page)).not.toContain("page=");
  });
});

test("groups with pages: a group or «Все» opens the first page, the next page of a group, back from a card", async ({
  page,
}) => {
  const tennis = await insertGroup("Теннис");
  const members = await insertNumberedContacts(150, { prefix: "Теннис", groupId: tennis });
  await insertNumberedContacts(100, { prefix: "Шахматист" });

  await test.step("«Включил группу»: the first page of the group, not the third of the list", async () => {
    await page.goto("/?page=3");
    await expect.poll(() => openPages(page)).toEqual(["3"]);

    await groupButton(page, "Теннис").click();

    await expect.poll(() => openPages(page)).toEqual(["1"]);
    expect(await addressSearch(page)).not.toContain("page=");
    await expect(caption(page)).toHaveText("Показаны 1–100 из 150");
    await expect(contactRows(page).first()).toContainText(members[0]);
  });

  await test.step("«Все»: the first page of the whole list", async () => {
    await page.goto(`/?group=${tennis}&page=2`);
    await expect.poll(() => openPages(page)).toEqual(["2"]);

    await groupButton(page, "Все").click();

    await expect.poll(() => openPages(page)).toEqual(["1"]);
    expect(await addressSearch(page)).toBe("");
    await expect(caption(page)).toHaveText("Показаны 1–100 из 250");
  });

  await test.step("«Следующая страница группы»: the rest of the members, the group is marked", async () => {
    await page.goto(`/?group=${tennis}`);
    await expect(contactRows(page)).toHaveCount(100);

    await pager(page).getByRole("link", { name: "Страница 2" }).click();

    await expect.poll(() => openPages(page)).toEqual(["2"]);
    await expect(contactRows(page)).toHaveCount(50);
    await expect(contactRows(page).first()).toContainText(members[100]);
    await expect(contactRows(page).last()).toContainText(members[149]);
    await expect(groupButton(page, "Теннис")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Шахматист")).toHaveCount(0);
  });

  await test.step("«Из фильтра по группе»: «Все контакты» goes back to the second page of the group", async () => {
    await openFirstCard(page);

    await backToList(page).click();

    await expect.poll(() => openPages(page)).toEqual(["2"]);
    await expect(groupButton(page, "Теннис")).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => addressSearch(page)).toBe(`?group=${tennis}&page=2`);
  });
});

test("«Загрузить ещё»: adds 100 under the open ones, stays after «Назад» and a reload", async ({
  page,
}) => {
  const names = await insertNumberedContacts(250);

  await test.step("«Подгрузил следующие 100»: 100 more under the first hundred, the screen does not jump", async () => {
    await page.goto("/");
    await expect(contactRows(page)).toHaveCount(100);
    // The button is in view, as when a person scrolled to the end of the list and presses it
    await loadMore(page).scrollIntoViewIfNeeded();
    const lastRow = contactRows(page).nth(99);
    const before = await lastRow.boundingBox();

    await loadMore(page).click();

    await expect(contactRows(page)).toHaveCount(200);
    await expect(contactRows(page).first()).toContainText(names[0]);
    await expect(contactRows(page).last()).toContainText(names[199]);
    await expect.poll(() => openPages(page)).toEqual(["1", "2"]);
    // The first hundred stayed where it was on the screen
    const after = await lastRow.boundingBox();
    expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(1);
    await expect(lastRow).toContainText(names[99]);
  });

  await test.step("«Вернулся назад или обновил»: the same 200 contacts", async () => {
    await openFirstCard(page);
    await page.goBack();

    await expect(contactRows(page)).toHaveCount(200);
    await expect.poll(() => openPages(page)).toEqual(["1", "2"]);

    await page.reload();

    await expect(contactRows(page)).toHaveCount(200);
    await expect.poll(() => openPages(page)).toEqual(["1", "2"]);
  });

  await test.step("«Из карточки после подгрузки»: «Все контакты» shows the same 200", async () => {
    await openFirstCard(page);

    await backToList(page).click();

    await expect(contactRows(page)).toHaveCount(200);
    await expect.poll(() => openPages(page)).toEqual(["1", "2"]);
  });

  await test.step("«Подгрузил до конца»: all 250, the button is gone", async () => {
    await loadMore(page).click();

    await expect(contactRows(page)).toHaveCount(250);
    await expect(contactRows(page).last()).toContainText(names[249]);
    await expect(loadMore(page)).toHaveCount(0);
    await expect.poll(() => openPages(page)).toEqual(["1", "2", "3"]);
  });
});

test("a new contact: its page opens, it is marked, a reload keeps the page without the notice", async ({
  page,
}) => {
  // 250 contacts, all before «Я» in the alphabet: the new one is the last, on the third page
  await insertNumberedContacts(250);

  await test.step("«Новый контакт на дальней странице»: its page, marked and in view", async () => {
    await addContactThroughForm(page, "Яна Яковлева");

    await expect(addedToast(page, "Яна Яковлева")).toBeVisible();
    await expect.poll(() => openPages(page)).toEqual(["3"]);
    await expect.poll(() => addressSearch(page)).toBe("?page=3");
    await expect(rowLink(page, "Яна Яковлева")).toHaveCSS("background-color", BUTTER);
    await expect(rowLink(page, "Яна Яковлева")).toBeInViewport();
  });

  await test.step("«Обновил после добавления»: the same page, no notice", async () => {
    await page.reload();

    await expect.poll(() => openPages(page)).toEqual(["3"]);
    await expect(rowLink(page, "Яна Яковлева")).toBeVisible();
    await expect(addedToast(page, "Яна Яковлева")).toHaveCount(0);
  });

  await test.step("«Новый контакт на первой странице»: the first page, marked, as before", async () => {
    await addContactThroughForm(page, "Аарон Абрамов");

    await expect(addedToast(page, "Аарон Абрамов")).toBeVisible();
    await expect.poll(() => openPages(page)).toEqual(["1"]);
    await expect.poll(() => addressSearch(page)).toBe("");
    await expect(rowLink(page, "Аарон Абрамов")).toHaveCSS("background-color", BUTTER);
  });
});

test("«Чужой или несуществующий контакт в адресе»: the first page, nothing marked, no notice", async ({
  page,
  otherUser,
  userEmail,
}) => {
  await insertNumberedContacts(250);
  // A contact of the other user: the test data goes to the user the test acts as
  actAs(otherUser.email);
  const foreignId = await insertContact({ name: "Чужой Человек" });
  actAs(userEmail);

  for (const id of [foreignId, 999_999]) {
    await page.goto(`/?added=${id}`);

    await expect(contactRows(page)).toHaveCount(100);
    await expect.poll(() => openPages(page)).toEqual(["1"]);
    await expect(page.getByText(/^Контакт «.*» добавлен$/)).toHaveCount(0);
    await expect(contactRows(page).first().getByRole("link")).not.toHaveCSS(
      "background-color",
      BUTTER,
    );
  }
});

test("«Все контакты» and the logo: back to the list as it was left, the logo to the first page", async ({
  page,
}) => {
  await insertGroup("Теннис");
  await insertNumberedContacts(250);

  await test.step("«Из карточки»: the same page", async () => {
    await page.goto("/?page=3");
    await openFirstCard(page);

    await backToList(page).click();

    await expect.poll(() => addressSearch(page)).toBe("?page=3");
    await expect.poll(() => openPages(page)).toEqual(["3"]);
  });

  await test.step("«После правки контакта»: the same page", async () => {
    await openFirstCard(page);
    await page.getByRole("link", { name: "Изменить" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Изменить контакт" })).toBeVisible();
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(page).toHaveURL(/\/contacts\/\d+$/);
    await expect(page.getByRole("heading", { level: 1, name: /^Контакт \d{3}$/ })).toBeVisible();

    await backToList(page).click();

    await expect.poll(() => openPages(page)).toEqual(["3"]);
  });

  await test.step("«Из формы нового контакта»: the same page, nothing added", async () => {
    await page.getByRole("link", { name: "Добавить контакт" }).click();
    await expect(page).toHaveURL(/\/contacts\/new$/);

    await backToList(page).click();

    await expect.poll(() => openPages(page)).toEqual(["3"]);
    await expect(page.getByText("250 контактов", { exact: true })).toBeVisible();
  });

  await test.step("«Со страницы «Группы»»: the same page", async () => {
    await page.getByRole("link", { name: "Управление группами" }).click();
    await expect(page).toHaveURL(/\/groups$/);

    await backToList(page).click();

    await expect.poll(() => openPages(page)).toEqual(["3"]);
  });

  await test.step("«Логотип»: the first page", async () => {
    await openFirstCard(page);

    await page.getByRole("link", { name: "Context", exact: true }).click();

    await expect.poll(() => openPages(page)).toEqual(["1"]);
    await expect.poll(() => addressSearch(page)).toBe("");
  });

  await test.step("«Список в этой вкладке не открывали»: the first page", async () => {
    const contactId = await insertContact({ name: "Яна Яковлева" });
    // This tab shows the third page; another tab of the same browser has not seen the list at all
    await page.goto("/?page=3");
    await expect.poll(() => openPages(page)).toEqual(["3"]);
    const otherTab = await page.context().newPage();

    await otherTab.goto(`/contacts/${contactId}`);
    await expect(otherTab.getByRole("heading", { level: 1, name: "Яна Яковлева" })).toBeVisible();
    await backToList(otherTab).click();

    await expect.poll(() => openPages(otherTab)).toEqual(["1"]);
    await expect.poll(() => addressSearch(otherTab)).toBe("");
  });
});
