import { PlusIcon } from "lucide-react";
import Link from "next/link";

import { AddedContactNotice } from "@/components/added-contact-notice";
import { ContactAvatar } from "@/components/contact-avatar";
import { ContactSearch } from "@/components/contact-search";
import { Button } from "@/components/ui/button";
import { countContacts, listContacts, type ContactListItem } from "@/db/queries";
import { formatContactCount, groupLetter } from "@/lib/format";
import { parseContactId } from "@/lib/ids";
import { cn } from "@/lib/utils";

// Always read fresh data from the database: any browser sees the same contacts
export const dynamic = "force-dynamic";

function groupByLetter(items: ContactListItem[]) {
  const groups: { letter: string; items: ContactListItem[] }[] = [];
  for (const item of items) {
    const letter = groupLetter(item.name);
    const last = groups.at(-1);
    if (last?.letter === letter) {
      last.items.push(item);
    } else {
      groups.push({ letter, items: [item] });
    }
  }
  return groups;
}

export default async function ContactsPage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const addedId = parseContactId(params.added);

  const [items, total] = await Promise.all([listContacts(query), countContacts()]);
  const groups = groupByLetter(items);
  const added = addedId === null ? undefined : items.find((item) => item.id === addedId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Контакты</h1>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {query
              ? `Найдено: ${items.length.toLocaleString("ru-RU")} из ${formatContactCount(total)}`
              : formatContactCount(total)}
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/contacts/new">
            <PlusIcon data-icon="inline-start" />
            Добавить контакт
          </Link>
        </Button>
      </div>

      <div className="sticky top-0 z-10 -mx-4 bg-neutral-50/95 px-4 py-2 backdrop-blur">
        <ContactSearch query={query} />
      </div>

      {items.length === 0 ? (
        <EmptyState query={query} />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-background">
          {groups.map((group) => (
            <section key={group.letter} aria-label={`На букву ${group.letter}`}>
              <h2 className="border-b bg-muted/60 px-4 py-1 text-xs font-semibold text-muted-foreground">
                {group.letter}
              </h2>
              <ul className="divide-y">
                {group.items.map((item) => (
                  <li key={item.id} id={`contact-${item.id}`}>
                    <Link
                      href={`/contacts/${item.id}`}
                      prefetch={false}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none",
                        item.id === added?.id && "bg-emerald-50 hover:bg-emerald-100",
                      )}
                    >
                      <ContactAvatar name={item.name} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{item.name}</div>
                        {item.about ? (
                          <div className="truncate text-sm text-muted-foreground">{item.about}</div>
                        ) : null}
                      </div>
                      <div className="hidden shrink-0 text-right text-sm text-muted-foreground sm:block">
                        {item.phone ? <div>{item.phone}</div> : null}
                        {item.email ? <div className="max-w-56 truncate">{item.email}</div> : null}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {added ? <AddedContactNotice contactId={added.id} name={added.name} /> : null}
    </div>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-background px-6 py-12 text-center">
      {query ? (
        <>
          <p className="font-medium">Никого не нашли по запросу «{query}»</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Проверьте написание или поищите по части имени.
          </p>
        </>
      ) : (
        <>
          <p className="font-medium">Пока нет ни одного контакта</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Добавьте первого человека — нажмите «Добавить контакт».
          </p>
        </>
      )}
    </div>
  );
}
