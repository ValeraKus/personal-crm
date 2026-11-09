// The tests of the app's pages sign in first: nothing opens without login. Use `test` from here
// instead of the one from Playwright: before each test the `page` is signed in, under an address of
// the test's own (`userEmail`), through the real form and the real email in Mailpit.
// `otherUser` is the second person for the tests of two users: another browser, another address.

import { test as base, type Page } from "@playwright/test";

import { signIn } from "./auth";
import { newEmail } from "./mailpit";
import { actAs } from "./test-database";

export { expect } from "@playwright/test";

export const test = base.extend<{
  userEmail: string;
  otherUser: { page: Page; email: string };
}>({
  userEmail: [
    async ({ page }, provide) => {
      const email = newEmail("user");
      await signIn(page, email);
      // The data the test puts into the database goes to this user
      actAs(email);
      await provide(email);
    },
    { auto: true },
  ],
  otherUser: async ({ browser, baseURL }, provide) => {
    // A new context is a clean browser: no cookies, nothing shared with the first one
    const context = await browser.newContext({ baseURL });
    try {
      const page = await context.newPage();
      const email = newEmail("other");
      await signIn(page, email);
      await provide({ page, email });
    } finally {
      await context.close();
    }
  },
});
