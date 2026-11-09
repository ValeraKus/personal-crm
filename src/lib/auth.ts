import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";

import { getDb } from "@/db";
import { forgetLoginLink, isLatestLoginLink, recordLoginLink } from "@/db/login-links";
import { accounts, sessions, users, verifications } from "@/db/schema";
import { sendLoginEmail } from "@/lib/mail";
import { parseLoginEmail } from "@/lib/validation";

// Page the link from the email leads to when it cannot be used (used, expired, or not the latest)
export const LINK_EXPIRED_PATH = "/login/link-expired";

// Error codes of the login request: the form maps them to the texts under the field
export const LOGIN_ERROR_RATE_LIMITED = "LOGIN_RATE_LIMITED";
export const LOGIN_ERROR_NOT_SENT = "LOGIN_EMAIL_NOT_SENT";
export const LOGIN_ERROR_BAD_EMAIL = "LOGIN_BAD_EMAIL";

const LINK_LIFETIME_SECONDS = 15 * 60;
// The built-in limit of Better Auth per IP address stays on as the second barrier, but wider than its
// default of 5 a minute. Behind nginx every visitor has an address of his own. Without one (the e2e
// tests, which all come from the same place and open many links) all requests share one counter.
// The limit of emails per address (login_links) is what protects the sending.
const BUILT_IN_LIMIT = { window: 60, max: 100 };
const SESSION_LIFETIME_SECONDS = 30 * 24 * 60 * 60;
const SESSION_REFRESH_SECONDS = 24 * 60 * 60;

function createAuth() {
  return betterAuth({
    // Secret and address come from BETTER_AUTH_SECRET and BETTER_AUTH_URL
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      usePlural: true,
      schema: { users, sessions, accounts, verifications },
    }),
    // 30 days since the last visit on this device: the term moves forward on a visit, but not more
    // often than once a day. Every browser has a session of its own.
    session: { expiresIn: SESSION_LIFETIME_SECONDS, updateAge: SESSION_REFRESH_SECONDS },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        // A direct request to the server goes by the same rules as the form
        if (ctx.path === "/sign-in/magic-link") {
          const parsed = parseLoginEmail((ctx.body as { email?: unknown } | undefined)?.email);
          if (!parsed.ok) {
            throw new APIError("BAD_REQUEST", {
              message: parsed.message,
              code: LOGIN_ERROR_BAD_EMAIL,
            });
          }
          return { context: { ...ctx, body: { ...ctx.body, email: parsed.email } } };
        }

        // Only the latest link of an address works: asking for a new link cancels the older ones
        if (ctx.path === "/magic-link/verify") {
          const token = typeof ctx.query?.token === "string" ? ctx.query.token : "";
          if (!(await isLatestLoginLink(token))) {
            throw ctx.redirect(LINK_EXPIRED_PATH);
          }
        }
      }),
    },
    plugins: [
      magicLink({
        expiresIn: LINK_LIFETIME_SECONDS,
        rateLimit: BUILT_IN_LIMIT,
        // The first login of an address creates the user: there is no separate sign up
        disableSignUp: false,
        async sendMagicLink({ email, url, token }) {
          const recorded = await recordLoginLink(email, token);
          if (!recorded.ok) {
            throw new APIError("TOO_MANY_REQUESTS", {
              message: "Слишком часто, попробуйте через несколько минут",
              code: LOGIN_ERROR_RATE_LIMITED,
            });
          }
          try {
            await sendLoginEmail(email, url);
          } catch (error) {
            // An email that was not sent does not count towards the limit
            console.error("Login email was not sent:", error);
            await forgetLoginLink(recorded.id);
            throw new APIError("INTERNAL_SERVER_ERROR", {
              message: "Не удалось отправить письмо, попробуйте ещё раз",
              code: LOGIN_ERROR_NOT_SENT,
            });
          }
        },
      }),
      // Must be the last plugin: it lets server actions set the cookies of the session
      nextCookies(),
    ],
  });
}

let auth: ReturnType<typeof createAuth> | undefined;

// Created on first use, not on import: `next build` loads every page module and runs without
// DATABASE_URL and BETTER_AUTH_SECRET
export function getAuth() {
  auth ??= createAuth();
  return auth;
}
