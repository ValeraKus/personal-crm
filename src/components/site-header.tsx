import Link from "next/link";

import { signOut } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/session";

// The top of every page: the logo, and for a signed-in user his email and «Выйти».
// On the login pages nobody is signed in, so there is only the logo.
export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="mx-auto w-full max-w-3xl px-4 pt-5 sm:pt-7">
      <div className="flex h-11 items-center gap-3 px-1 sm:h-14 sm:px-0">
        <Link href="/" className="font-pixel text-11 sm:text-14">
          Context
        </Link>
        {user ? (
          <div className="ml-auto flex min-w-0 items-center gap-3">
            {/* A long address is cut with an ellipsis, so the button stays in place */}
            <span className="min-w-0 truncate text-13 text-ink-muted sm:text-14" title={user.email}>
              {user.email}
            </span>
            <form action={signOut} className="shrink-0">
              <Button type="submit" variant="outline" size="sm">
                Выйти
              </Button>
            </form>
          </div>
        ) : null}
      </div>
    </header>
  );
}
