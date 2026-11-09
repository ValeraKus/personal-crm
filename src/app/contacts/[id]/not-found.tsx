import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Window } from "@/components/window";

// The card and the edit form of a contact that does not exist, and of one that belongs to somebody
// else: the same words for both, so nobody can tell from the answer that a number is taken
export default function ContactNotFound() {
  return (
    <Window title="404" bar="accent" controls={2} className="mx-auto w-full max-w-xl">
      <div className="flex flex-col items-center gap-4 px-5 py-10 text-center sm:px-8">
        <h1 className="font-display text-18 leading-heading uppercase sm:text-22">
          Контакт не найден
        </h1>
        <p className="text-15 leading-body text-ink-soft">
          Возможно, его удалили или в адресе опечатка.
        </p>
        <Button asChild className="mt-2">
          <Link href="/">К списку контактов</Link>
        </Button>
      </div>
    </Window>
  );
}
