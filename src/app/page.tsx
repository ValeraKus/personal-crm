import Link from "next/link";

import { AddedContactNotice } from "@/components/added-contact-notice";
import { ContactAvatar } from "@/components/contact-avatar";
import { ContactSearch } from "@/components/contact-search";
import { KeepInTouchBlock, type OverdueContact } from "@/components/keep-in-touch-block";
import { PixelIcon } from "@/components/pixel-icon";
import { Button } from "@/components/ui/button";
import { Window } from "@/components/window";
import {
  countContacts,
  listContacts,
  listContactsWithTerm,
  type ContactListItem,
} from "@/db/queries";
import { formatContactCount, groupLetter } from "@/lib/format";
import { parseContactId } from "@/lib/ids";
import { getTermStatus, isFrequency } from "@/lib/keep-in-touch";
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

// Overdue contacts, most overdue first; the stable sort keeps the alphabetical order of equals
async function listOverdueContacts() {
  const rows = await listContactsWithTerm();
  const now = new Date();
  const overdue: OverdueContact[] = [];
  for (const row of rows) {
    if (!isFrequency(row.keepInTouchFrequency)) continue;
    const status = getTermStatus(
      {
        frequency: row.keepInTouchFrequency,
        days: row.keepInTouchDays,
        since: row.keepInTouchSince,
        lastNoteAt: row.lastNoteAt,
      },
      now,
    );
    if (status && status.overdueDays > 0) {
      overdue.push({
        id: row.id,
        name: row.name,
        label: status.label,
        overdueDays: status.overdueDays,
      });
    }
  }
  return overdue.sort((a, b) => b.overdueDays - a.overdueDays);
}

export default async function ContactsPage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const addedId = parseContactId(params.added);

  // The block is hidden while searching, so its query is skipped too
  const [items, total, overdue] = await Promise.all([
    listContacts(query),
    countContacts(),
    query ? [] : listOverdueContacts(),
  ]);
  const groups = groupByLetter(items);
  const added = addedId === null ? undefined : items.find((item) => item.id === addedId);

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="flex flex-col gap-3">
          <h1 className="font-display text-30 leading-heading uppercase sm:text-44">Контакты</h1>
          <p className="font-pixel text-9 text-ink-faint sm:text-10" aria-live="polite">
            {query
              ? `Найдено: ${items.length.toLocaleString("ru-RU")} из ${formatContactCount(total)}`
              : formatContactCount(total)}
          </p>
        </div>
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link href="/contacts/new">
            <PixelIcon name="plus" />
            Добавить контакт
          </Link>
        </Button>
      </div>

      {overdue.length > 0 ? <KeepInTouchBlock contacts={overdue} /> : null}

      <Window title="контакты.exe" bar="accent" controls={3}>
        <div className="sticky top-0 z-10 border-b-2 border-ink bg-white p-3 sm:p-4">
          <ContactSearch query={query} />
        </div>

        {items.length === 0 ? (
          <EmptyState query={query} />
        ) : (
          groups.map((group) => (
            <section
              key={group.letter}
              aria-label={`На букву ${group.letter}`}
              className="not-last:border-b-2 not-last:border-ink"
            >
              <h2 className="border-b-2 border-ink bg-paper px-4 py-2 font-pixel text-10">
                {group.letter}
              </h2>
              <ul className="divide-y-2 divide-dashed divide-lilac">
                {group.items.map((item) => (
                  <li key={item.id} id={`contact-${item.id}`}>
                    <Link
                      href={`/contacts/${item.id}`}
                      prefetch={false}
                      className={cn(
                        "flex items-center gap-3.5 px-4 py-3 hover:bg-paper focus-visible:bg-paper focus-visible:-outline-offset-3",
                        item.id === added?.id && "bg-butter hover:bg-butter",
                      )}
                    >
                      <ContactAvatar name={item.name} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-16 font-semibold">{item.name}</div>
                        {item.about ? (
                          <div className="truncate text-14 text-ink-muted">{item.about}</div>
                        ) : null}
                      </div>
                      <div className="hidden shrink-0 text-right text-14 text-ink-muted sm:block">
                        {item.phone ? <div>{item.phone}</div> : null}
                        {item.email ? <div className="max-w-56 truncate">{item.email}</div> : null}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </Window>

      {added ? <AddedContactNotice contactId={added.id} name={added.name} /> : null}
    </div>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <PixelIcon
        name={query ? "search" : "heart"}
        className={cn("mb-2 text-accent", query ? "size-8" : "h-6 w-7")}
      />
      {query ? (
        <>
          <p className="text-16 font-semibold">Никого не нашли по запросу «{query}»</p>
          <p className="text-14 text-ink-muted">Проверьте написание или поищите по части имени.</p>
        </>
      ) : (
        <>
          <p className="text-16 font-semibold">Пока нет ни одного контакта</p>
          <p className="text-14 text-ink-muted">
            Добавьте первого человека — нажмите «Добавить контакт».
          </p>
        </>
      )}
    </div>
  );
}
