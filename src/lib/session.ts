import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { getAuth } from "@/lib/auth";

export const LOGIN_PATH = "/login";

export type CurrentUser = { id: string; email: string };

// The user of this request, or null when nobody is signed in. Read once per request.
// Doesn't redirect: the header uses it to show the email or nothing.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getAuth().api.getSession({ headers: await headers() });
  return session ? { id: session.user.id, email: session.user.email } : null;
});

// Every page and every action starts with this. Nobody signed in: to the login page.
// The owner of the data is always taken from here, never from a form or an address.
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(LOGIN_PATH);
  return user;
}
