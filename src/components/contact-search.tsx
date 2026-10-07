"use client";

import { SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition, type FormEvent } from "react";

import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

const SEARCH_DELAY_MS = 250;

export function ContactSearch({ query }: { query: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // The address changed from outside (e.g. a link to the full list): show the new query
  useEffect(() => {
    const input = inputRef.current;
    if (input && document.activeElement !== input && input.value.trim() !== query) {
      input.value = query;
    }
  }, [query]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  function search(value: string) {
    clearTimeout(timerRef.current);
    const nextQuery = value.trim();
    const url = nextQuery ? `/?q=${encodeURIComponent(nextQuery)}` : "/";
    startTransition(() => router.replace(url, { scroll: false }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    search(inputRef.current?.value ?? "");
  }

  return (
    <form role="search" action="/" onSubmit={handleSubmit} className="relative">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        type="search"
        name="q"
        defaultValue={query}
        placeholder="Найти по имени"
        aria-label="Найти контакт по имени"
        autoComplete="off"
        className="h-10 pr-9 pl-9 text-base md:text-sm"
        onChange={(event) => {
          const value = event.currentTarget.value;
          clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => search(value), SEARCH_DELAY_MS);
        }}
      />
      {isPending ? (
        <Spinner className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground" />
      ) : null}
    </form>
  );
}
