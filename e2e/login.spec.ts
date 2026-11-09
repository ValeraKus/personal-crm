// Scenarios from openspec/specs/user-auth/spec.md, walked through in the browser.
// Each test is one requirement, each step is a scenario of it. The scenario «На сервере» is not here:
// it needs the real server and the real mailbox, the owner checks it by hand after the deploy.
// Emails go to Mailpit, nothing leaves the computer. Every test signs in under an address of its
// own, so tests do not get in the way of each other.

import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

import { requestLink, signIn } from "./auth";
import {
  buttonLinkOf,
  countAllEmails,
  countEmailsTo,
  makeMailFail,
  newEmail,
  readLatestEmail,
  waitForLoginLink,
  waitForLoginLinks,
} from "./mailpit";
import {
  ageSentLinks,
  countUsers,
  expireLoginLink,
  sessionEndsAt,
  setLastVisit,
} from "./test-database";

const EXPIRED_TEXT = "Ссылка устарела, запросите новую";
const DAY_MS = 24 * 60 * 60 * 1000;

// Mailpit must not stay in the failing mode after a test that turned it on
test.afterEach(async () => {
  await makeMailFail(false);
});

async function expectLoginPage(page: Page) {
  await expect(page.getByRole("heading", { level: 1, name: "Вход" })).toBeVisible();
  await expect(page.getByLabel("Почта")).toBeVisible();
  await expect(page.getByRole("button", { name: "Получить ссылку" })).toBeVisible();
}

async function expectContactsPage(page: Page) {
  await expect(page.getByRole("heading", { level: 1, name: "Контакты" })).toBeVisible();
}

async function expectLinkExpired(page: Page) {
  await expect(page.getByRole("heading", { name: EXPIRED_TEXT })).toBeVisible();
  await expect(page.getByRole("link", { name: "На страницу входа" })).toBeVisible();
}

async function expectSignedInAs(page: Page, email: string) {
  await expect(page.getByRole("banner").getByText(email)).toBeVisible();
  await expect(page.getByRole("button", { name: "Выйти" })).toBeVisible();
}

// A clean browser: no cookies, nothing shared with the others
async function newBrowser(browser: Browser, baseURL: string | undefined) {
  const context = await browser.newContext({ baseURL });
  return { context, page: await context.newPage() };
}

async function askForLink(page: Page, email: string) {
  await page.getByLabel("Почта").fill(email);
  await page.getByRole("button", { name: "Получить ссылку" }).click();
}

test("without login every page is the login page; /health answers without it", async ({
  page,
  request,
}) => {
  await test.step("scenario «Открыл без входа»: the pages lead to the login page", async () => {
    for (const path of ["/", "/contacts/1", "/contacts/new", "/groups"]) {
      await page.goto(path);
      await expectLoginPage(page);
      await expect(page.getByRole("heading", { level: 1, name: "Контакты" })).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Управление группами" })).toHaveCount(0);
    }
  });

  await test.step("scenario «Проверка выкатки»: /health answers without login and shows no data", async () => {
    // The request fixture has no cookies: it is not signed in
    const response = await request.get("/health");
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(JSON.parse(body).status).toBe("ok");
    expect(body).not.toContain("@");
  });
});

test("a signed-in user opening the login page gets the contact list", async ({ page }) => {
  await test.step("scenario «Уже вошёл»", async () => {
    await signIn(page, newEmail("already"));
    await page.goto("/login");
    await expectContactsPage(page);
  });
});

test("asking for a link: sent, the same message for everybody, the email did not leave", async ({
  page,
  browser,
  baseURL,
}) => {
  const email = newEmail("ask");

  await test.step("scenario «Отправил ссылку»: the message, the form stays, the email arrives", async () => {
    await page.goto("/login");
    await askForLink(page, email);

    await expect(page.getByText(`Ссылка для входа отправлена на ${email}`)).toBeVisible();
    await expect(page.getByLabel("Почта")).toBeVisible();
    await expect(page.getByRole("button", { name: "Получить ссылку" })).toBeVisible();
    expect(await waitForLoginLink(email)).toContain("/api/auth/magic-link/verify");
  });

  await test.step("scenario «Не выдаём, есть ли пользователь»: a new address and a known one get the same message", async () => {
    // The first link creates the user; then the address is a known one
    await page.goto(await waitForLoginLink(email));
    await page.getByRole("button", { name: "Выйти" }).click();
    const newAddress = newEmail("fresh");

    const other = await newBrowser(browser, baseURL);
    try {
      await other.page.goto("/login");
      await askForLink(other.page, newAddress);
      await expect(
        other.page.getByText(`Ссылка для входа отправлена на ${newAddress}`),
      ).toBeVisible();
    } finally {
      await other.context.close();
    }

    await expectLoginPage(page);
    await askForLink(page, email);
    await expect(page.getByText(`Ссылка для входа отправлена на ${email}`)).toBeVisible();
    await expect(page.getByText(/не найден|не зарегистрирован|уже есть/i)).toHaveCount(0);
  });

  await test.step("scenario «Письмо не ушло»: an error under the field, no message about sending", async () => {
    const failing = newEmail("fail");
    await makeMailFail(true);
    await page.goto("/login");
    await askForLink(page, failing);

    await expect(page.getByText("Не удалось отправить письмо, попробуйте ещё раз")).toBeVisible();
    await expect(page.getByText(/Ссылка для входа отправлена/)).toHaveCount(0);
    await makeMailFail(false);
    expect(await countEmailsTo(failing)).toBe(0);
  });
});

test("checking the address: wrong addresses, spaces and case, a request that skips the form", async ({
  page,
  request,
  baseURL,
}) => {
  await test.step("scenario «Неверный адрес»: an error under the field, no email", async () => {
    const before = await countAllEmails();
    await page.goto("/login");
    for (const wrong of ["ivan@", ""]) {
      await askForLink(page, wrong);
      await expect(page.getByText("Проверьте адрес почты")).toBeVisible();
      await expect(page.getByText(/Ссылка для входа отправлена/)).toHaveCount(0);
    }
    expect(await countAllEmails()).toBe(before);
  });

  await test.step("scenario «Пробелы и регистр»: the same user whatever the spaces and case", async () => {
    const email = newEmail("ivan");
    const typed = `  ${email.replace(/^ivan/, "Ivan").replace("@example.com", "@Example.com")}  `;
    const name = `Контакт ${email}`;

    await page.goto("/login");
    await askForLink(page, typed);
    await page.goto(await waitForLoginLink(email));
    await expectSignedInAs(page, email);

    await page.goto("/contacts/new");
    await page.getByLabel("Имя и фамилия").fill(name);
    await page.getByRole("button", { name: "Добавить контакт" }).click();
    await expect(page.getByText(`Контакт «${name}» добавлен`)).toBeVisible();

    await page.getByRole("button", { name: "Выйти" }).click();
    await expectLoginPage(page);
    await signIn(page, email);
    await expectSignedInAs(page, email);
    await expect(page.getByRole("link", { name })).toBeVisible();
    expect(await countUsers(email)).toBe(1);
  });

  await test.step("scenario «Запрос не из формы»: the server refuses a wrong address", async () => {
    const before = await countAllEmails();
    const response = await request.post("/api/auth/sign-in/magic-link", {
      headers: { Origin: baseURL! },
      data: { email: "ivan@" },
    });

    expect(response.status()).toBe(400);
    expect(await countAllEmails()).toBe(before);
  });
});

test("the link: one use, 15 minutes, first login is sign up, a new link cancels the old ones", async ({
  page,
  browser,
  baseURL,
}) => {
  await test.step("scenarios «Вход по ссылке» and «Первый вход — это регистрация»: inside at once, no form, no question about the name", async () => {
    const email = newEmail("first");
    expect(await countUsers(email)).toBe(0);

    await requestLink(page, email);
    await page.goto(await waitForLoginLink(email));

    await expectContactsPage(page);
    await expectSignedInAs(page, email);
    await expect(page.getByLabel(/имя/i)).toHaveCount(0);
    expect(await countUsers(email)).toBe(1);
  });

  await test.step("scenario «Ссылка второй раз»: the used link is outdated", async () => {
    const email = newEmail("twice");
    // The page is still signed in from the previous step
    await page.context().clearCookies();
    await requestLink(page, email);
    const link = await waitForLoginLink(email);
    await page.goto(link);
    await expectSignedInAs(page, email);

    const other = await newBrowser(browser, baseURL);
    try {
      await other.page.goto(link);
      await expectLinkExpired(other.page);
      await other.page.goto("/");
      await expectLoginPage(other.page);
    } finally {
      await other.context.close();
    }
  });

  await test.step("scenario «Прошло 15 минут»: the link is outdated", async () => {
    const email = newEmail("late");
    const other = await newBrowser(browser, baseURL);
    try {
      await requestLink(other.page, email);
      const link = await waitForLoginLink(email);
      await expireLoginLink(email);

      await other.page.goto(link);
      await expectLinkExpired(other.page);
      await other.page.goto("/");
      await expectLoginPage(other.page);
    } finally {
      await other.context.close();
    }
  });

  await test.step("scenario «Запросил новую ссылку»: the first link is outdated, the second works", async () => {
    const email = newEmail("again");
    const other = await newBrowser(browser, baseURL);
    try {
      await requestLink(other.page, email);
      await askForLink(other.page, email);
      const [first, second] = await waitForLoginLinks(email, 2);

      await other.page.goto(first);
      await expectLinkExpired(other.page);

      await other.page.goto(second);
      await expectSignedInAs(other.page, email);
    } finally {
      await other.context.close();
    }
  });

  await test.step("scenario «Кнопка на страницу входа»", async () => {
    await page.context().clearCookies();
    await page.goto("/api/auth/magic-link/verify?token=not-a-real-token&callbackURL=%2F");
    await expectLinkExpired(page);

    await page.getByRole("link", { name: "На страницу входа" }).click();
    await expectLoginPage(page);
  });

  await test.step("scenario «Ссылка под другой почтой»: inside under the address of the link", async () => {
    const first = newEmail("one");
    const second = newEmail("two");
    await signIn(page, first);

    const other = await newBrowser(browser, baseURL);
    try {
      await requestLink(other.page, second);
    } finally {
      await other.context.close();
    }
    await page.goto(await waitForLoginLink(second));

    await expectSignedInAs(page, second);
    await expect(page.getByRole("banner").getByText(first)).toHaveCount(0);
  });
});

test("limit of emails: three in 10 minutes, every address on its own", async ({ page }) => {
  const email = newEmail("limit");

  await test.step("scenario «Четвёртое письмо»: an error under the field, no fourth email", async () => {
    await page.goto("/login");
    for (let sent = 1; sent <= 3; sent++) {
      await askForLink(page, email);
      await waitForLoginLinks(email, sent);
    }

    await askForLink(page, email);
    await expect(page.getByText("Слишком часто, попробуйте через несколько минут")).toBeVisible();
    await expect(page.getByText(/Ссылка для входа отправлена/)).toHaveCount(0);
    expect(await countEmailsTo(email)).toBe(3);
  });

  await test.step("scenario «Другая почта»: the email to another address goes", async () => {
    const other = newEmail("other");
    await askForLink(page, other);
    await expect(page.getByText(`Ссылка для входа отправлена на ${other}`)).toBeVisible();
    await waitForLoginLinks(other, 1);
  });

  await test.step("scenario «Прошло 10 минут»: a link can be asked for again", async () => {
    await ageSentLinks(email, "11 minutes");
    await askForLink(page, email);

    await expect(page.getByText(`Ссылка для входа отправлена на ${email}`)).toBeVisible();
    await waitForLoginLinks(email, 4);
  });

  await test.step("scenario «Неотправленное письмо не в счёт»: all three later emails go", async () => {
    const unlucky = newEmail("unsent");
    await makeMailFail(true);
    await askForLink(page, unlucky);
    await expect(page.getByText("Не удалось отправить письмо, попробуйте ещё раз")).toBeVisible();
    await makeMailFail(false);

    for (let sent = 1; sent <= 3; sent++) {
      await askForLink(page, unlucky);
      await waitForLoginLinks(unlucky, sent);
    }
    await expect(page.getByText(`Ссылка для входа отправлена на ${unlucky}`)).toBeVisible();
    expect(await countEmailsTo(unlucky)).toBe(3);
  });
});

test("the email: sender, subject, button, and the button signs in", async ({ page }) => {
  const email = newEmail("mail");
  await requestLink(page, email);
  await waitForLoginLink(email);

  await test.step("scenario «Что в письме»", async () => {
    const message = await readLatestEmail(email);

    expect(message.From.Name).toBe("Личная CRM");
    expect(message.From.Address).toBe("noreply@mail.crm.context-crm.site");
    expect(message.Subject).toBe("Вход в Личную CRM");
    expect(message.HTML).toContain("Войти");
    expect(message.HTML).toContain("15 минут");
    expect(message.HTML).toContain("Если вы не запрашивали вход - просто проигнорируйте письмо");
  });

  await test.step("scenario «Кнопка в письме»: the «Войти» button signs in", async () => {
    await page.goto(buttonLinkOf(await readLatestEmail(email)));
    await expectSignedInAs(page, email);
  });
});

test("how long the login lasts: 30 days since the last visit, several devices", async ({
  page,
  browser,
  baseURL,
}) => {
  await test.step("scenario «Давно не заходил»: the login page", async () => {
    const email = newEmail("away");
    await signIn(page, email);

    // The last visit was more than 30 days ago
    await setLastVisit(email, "31 days");
    await page.goto("/");
    await expectLoginPage(page);
  });

  await test.step("scenario «Захожу регулярно»: still inside, the term moves 30 days forward", async () => {
    const email = newEmail("regular");
    await signIn(page, email);

    // Signed in more than 30 days ago, but last here 2 days ago: the session and the cookie of the
    // browser end in 28 days
    await setLastVisit(email, "2 days");
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((cookie) => cookie.name.endsWith("session_token"))!;
    await page
      .context()
      .addCookies([{ ...sessionCookie, expires: (Date.now() + 28 * DAY_MS) / 1000 }]);

    await page.goto("/");
    await expectSignedInAs(page, email);

    const endsAt = (await sessionEndsAt(email)).getTime();
    expect(endsAt - Date.now()).toBeGreaterThan(29.9 * DAY_MS);
    const renewed = (await page.context().cookies()).find((cookie) =>
      cookie.name.endsWith("session_token"),
    )!;
    expect(renewed.expires * 1000 - Date.now()).toBeGreaterThan(29.9 * DAY_MS);
  });

  await test.step("scenario «Несколько устройств»: inside in two browsers at once", async () => {
    const email = newEmail("devices");
    await page.context().clearCookies();
    await signIn(page, email);

    const other = await newBrowser(browser, baseURL);
    try {
      await signIn(other.page, email);
      await other.page.goto("/");
      await expectSignedInAs(other.page, email);

      await page.goto("/");
      await expectSignedInAs(page, email);
    } finally {
      await other.context.close();
    }
  });
});

test("the email in the header and signing out", async ({ page, browser, baseURL }) => {
  const email = newEmail("header");
  await signIn(page, email);

  await test.step("scenario «Почта в шапке»: on every page", async () => {
    for (const path of ["/", "/groups", "/contacts/new"]) {
      await page.goto(path);
      await expectSignedInAs(page, email);
    }
  });

  await test.step("scenario «Выход»: the login page, and the home page leads to it too", async () => {
    await page.getByRole("button", { name: "Выйти" }).click();
    await expectLoginPage(page);

    await page.goto("/");
    await expectLoginPage(page);
  });

  await test.step("scenario «Выход только на этом устройстве»: in the second browser still inside", async () => {
    await signIn(page, email);
    const other: { context: BrowserContext; page: Page } = await newBrowser(browser, baseURL);
    try {
      await signIn(other.page, email);

      await page.getByRole("button", { name: "Выйти" }).click();
      await expectLoginPage(page);

      await other.page.goto("/");
      await expectSignedInAs(other.page, email);
      await expectContactsPage(other.page);
    } finally {
      await other.context.close();
    }
  });
});

test("where the emails go: Mailpit, any address works", async ({ page }) => {
  await test.step("scenarios «На моём компьютере» and «В автотестах»: the email of a made-up address is in Mailpit", async () => {
    const email = newEmail("nobody-real");
    await requestLink(page, email);

    expect(await waitForLoginLink(email)).toMatch(/^http:\/\/127\.0\.0\.1:3100\//);
    await page.goto(await waitForLoginLink(email));
    await expectSignedInAs(page, email);
  });
});

test("a long address in the header on a phone does not break the page", async ({ page }) => {
  const email = newEmail("very-long-address-".padEnd(40, "x"));
  await signIn(page, email);
  await page.setViewportSize({ width: 360, height: 700 });

  await test.step("the page is not wider than the screen and «Выйти» stays on it", async () => {
    await page.goto("/");
    await expectSignedInAs(page, email);

    const pageIsWider = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(pageIsWider).toBe(false);
    const button = await page.getByRole("button", { name: "Выйти" }).boundingBox();
    expect(button!.x + button!.width).toBeLessThanOrEqual(360);
  });
});
