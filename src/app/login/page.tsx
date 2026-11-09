import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requestLoginLink } from "@/app/login/actions";
import { LoginForm } from "@/components/login-form";
import { Window } from "@/components/window";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Вход",
};

// Depends on who is asking: signed in or not
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Already inside: the login page has nothing to offer, show the contacts
  if (await getCurrentUser()) redirect("/");

  return (
    <Window title="вход.exe" bar="accent" controls={2} className="mx-auto w-full max-w-xl">
      <div className="flex flex-col gap-5 px-5 py-8 sm:px-8">
        <h1 className="font-display text-22 leading-heading uppercase sm:text-26">Вход</h1>
        <p className="text-15 leading-body text-ink-soft">
          Пароля нет: пришлём на почту ссылку, по ней вы войдёте.
        </p>
        <LoginForm action={requestLoginLink} />
      </div>
    </Window>
  );
}
