import Link from "next/link";

import { AddedContactNotice } from "@/components/added-contact-notice";
import { ContactAvatar } from "@/components/contact-avatar";
import { ContactSearch } from "@/components/contact-search";
import { KeepInTouchBlock, type OverdueContact } from "@/components/keep-in-touch-block";
import { PixelIcon } from "@/components/pixel-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Window } from "@/components/window";
import {
  countContacts,
  listContacts,
  listContactsWithTerm,
  listGroups,
  type ContactListItem,
} from "@/db/queries";
import { formatContactCount, groupLetter } from "@/lib/format";
import { parseContactId, parseGroupIds } from "@/lib/ids";
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

  // Ids from the address that match no group are ignored
  const allGroups = await listGroups();
  const knownIds = new Set(allGroups.map((group) => group.id));
  const selectedIds = parseGroupIds(params.group).filter((id) => knownIds.has(id));
  const filtered = query !== "" || selectedIds.length > 0;

  // The block is hidden while searching or filtering, so its query is skipped too
  const [items, total, overdue] = await Promise.all([
    listContacts(query, selectedIds),
    countContacts(),
    filtered ? [] : listOverdueContacts(),
  ]);
  const groups = groupByLetter(items);
  const added = addedId === null ? undefined : items.find((item) => item.id === addedId);

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="flex flex-col gap-3">
          <h1 className="font-display text-30 leading-heading uppercase sm:text-44">Контакты</h1>
          <p className="font-pixel text-9 text-ink-faint sm:text-10" aria-live="polite">
            {filtered
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

      {allGroups.length > 0 ? (
        <GroupFilter groups={allGroups} selectedIds={selectedIds} query={query} />
      ) : null}

      {overdue.length > 0 ? <KeepInTouchBlock contacts={overdue} /> : null}

      <Window title="контакты.exe" bar="accent" controls={3}>
        <div className="sticky top-0 z-10 border-b-2 border-ink bg-white p-3 sm:p-4">
          <ContactSearch query={query} groupIds={selectedIds} />
        </div>

        {items.length === 0 ? (
          <EmptyState query={query} groupCount={selectedIds.length} />
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

function groupFilterHref(ids: number[], query: string) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  for (const id of ids) params.append("group", String(id));
  const search = params.toString();
  return search ? `/?${search}` : "/";
}

// Each button is a plain link to the address with this group added to the choice or removed from it
function GroupFilter({
  groups,
  selectedIds,
  query,
}: {
  groups: { id: number; name: string }[];
  selectedIds: number[];
  query: string;
}) {
  return (
    <nav aria-label="Группы" className="flex flex-wrap items-center gap-2">
      <Badge asChild variant={selectedIds.length === 0 ? "default" : "outline"}>
        <Link
          href={groupFilterHref([], query)}
          aria-current={selectedIds.length === 0 || undefined}
        >
          Все
        </Link>
      </Badge>
      {groups.map((group) => {
        const selected = selectedIds.includes(group.id);
        const next = selected
          ? selectedIds.filter((id) => id !== group.id)
          : [...selectedIds, group.id];
        return (
          <Badge key={group.id} asChild variant={selected ? "default" : "outline"}>
            <Link href={groupFilterHref(next, query)} aria-pressed={selected}>
              {group.name}
            </Link>
          </Badge>
        );
      })}
      <Link href="/groups" className="ml-auto text-14 underline-offset-4 hover:underline">
        Управление группами
      </Link>
    </nav>
  );
}

function EmptyState({ query, groupCount }: { query: string; groupCount: number }) {
  if (groupCount > 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
        <PixelIcon name="search" className="mb-2 size-8 text-accent" />
        <p className="text-16 font-semibold">
          {query
            ? `Никого не нашли по запросу «${query}» в выбранных группах`
            : groupCount === 1
              ? "В этой группе пока нет контактов"
              : "Нет контактов, которые входят во все выбранные группы"}
        </p>
      </div>
    );
  }
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
