import type { Metadata } from "next";

import { BackLink } from "@/components/back-link";
import { GroupRow } from "@/components/group-row";
import { Window } from "@/components/window";
import { listGroupsWithCounts } from "@/db/queries";

export const metadata: Metadata = {
  title: "Группы",
};

// Always read fresh data from the database: any browser sees the same groups
export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const groups = await listGroupsWithCounts();

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <BackLink href="/">Все контакты</BackLink>
      <h1 className="font-display text-26 leading-heading uppercase sm:text-38">
        Группы
      </h1>
      <Window title="группы.exe" bar="lilac" controls={3} className="mt-2">
        {groups.length === 0 ? (
          <p className="px-4 py-8 text-center text-14 text-ink-muted">
            Групп пока нет. Создать группу можно в форме контакта.
          </p>
        ) : (
          <ul className="divide-y-2 divide-dashed divide-lilac">
            {groups.map((group) => (
              <GroupRow
                key={group.id}
                id={group.id}
                name={group.name}
                contactCount={group.contactCount}
              />
            ))}
          </ul>
        )}
      </Window>
    </div>
  );
}
