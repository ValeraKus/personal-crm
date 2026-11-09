import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Window } from "@/components/window";

export const metadata: Metadata = {
  title: "Ссылка устарела",
};

// The link from the email was already used, is older than 15 minutes, or a newer one was asked for
export default function LinkExpiredPage() {
  return (
    <Window title="вход.exe" bar="accent" controls={2} className="mx-auto w-full max-w-xl">
      <div className="flex flex-col items-start gap-4 px-5 py-8 sm:px-8">
        <h1 className="font-display text-18 leading-heading uppercase sm:text-22">
          Ссылка устарела, запросите новую
        </h1>
        <p className="text-15 leading-body text-ink-soft">
          Ссылка работает один раз и 15 минут, а новая ссылка отменяет прежние.
        </p>
        <Button asChild className="mt-2">
          <Link href="/login">На страницу входа</Link>
        </Button>
      </div>
    </Window>
  );
}
