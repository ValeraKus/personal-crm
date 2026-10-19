import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Window } from "@/components/window";

export default function NotFound() {
  return (
    <Window title="404" bar="accent" controls={2} className="mx-auto w-full max-w-xl">
      <div className="flex flex-col items-center gap-4 px-5 py-10 text-center sm:px-8">
        <h1 className="font-display text-18 leading-heading uppercase sm:text-22">
          Такой страницы нет
        </h1>
        <p className="text-15 leading-body text-ink-soft">
          Возможно, ссылка устарела или в адресе опечатка.
        </p>
        <Button asChild className="mt-2">
          <Link href="/">К списку контактов</Link>
        </Button>
      </div>
    </Window>
  );
}
