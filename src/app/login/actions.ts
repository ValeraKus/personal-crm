"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  LINK_EXPIRED_PATH,
  LOGIN_ERROR_NOT_SENT,
  LOGIN_ERROR_RATE_LIMITED,
  getAuth,
} from "@/lib/auth";
import { LOGIN_PATH } from "@/lib/session";
import { parseLoginEmail } from "@/lib/validation";

export type LoginFormState =
  { status: "idle" } | { status: "sent"; email: string } | { status: "error"; message: string };

// Texts of the errors under the field (in Russian: the user sees them)
const NOT_SENT_MESSAGE = "Не удалось отправить письмо, попробуйте ещё раз";
const RATE_LIMITED_MESSAGE = "Слишком часто, попробуйте через несколько минут";

// The login form: sends the link from the email. The message is the same for an address that
// nobody has used yet and for a known one, so the form does not tell who has an account.
export async function requestLoginLink(
  _state: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  // The server checks the address by the same rules, also for a request that skips the form
  const parsed = parseLoginEmail(formData.get("email"));
  if (!parsed.ok) return { status: "error", message: parsed.message };

  try {
    await getAuth().api.signInMagicLink({
      body: { email: parsed.email, callbackURL: "/", errorCallbackURL: LINK_EXPIRED_PATH },
      headers: await headers(),
    });
  } catch (error) {
    const code = error instanceof APIError ? error.body?.code : undefined;
    if (code === LOGIN_ERROR_RATE_LIMITED) {
      return { status: "error", message: RATE_LIMITED_MESSAGE };
    }
    if (code !== LOGIN_ERROR_NOT_SENT) {
      console.error("Login link request failed:", error);
    }
    return { status: "error", message: NOT_SENT_MESSAGE };
  }

  return { status: "sent", email: parsed.email };
}

// «Выйти»: ends the login of this browser only, the other devices stay signed in
export async function signOut() {
  await getAuth().api.signOut({ headers: await headers() });
  redirect(LOGIN_PATH);
}
