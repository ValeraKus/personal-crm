// Login for the tests: through the real form and the real email in Mailpit, like a person.

import { expect, type Page } from "@playwright/test";

import { waitForLoginLink } from "./mailpit";

// Asks for a link on the login page and waits until the form says it was sent
export async function requestLink(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Почта").fill(email);
  await page.getByRole("button", { name: "Получить ссылку" }).click();
  await expect(page.getByText(`Ссылка для входа отправлена на ${email}`)).toBeVisible();
}

// Signs in the browser of the page under the address: the first login creates the user
export async function signIn(page: Page, email: string) {
  await requestLink(page, email);
  await page.goto(await waitForLoginLink(email));
  await expect(page.getByRole("button", { name: "Выйти" })).toBeVisible();
}
