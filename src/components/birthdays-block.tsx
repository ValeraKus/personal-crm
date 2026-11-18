import Link from "next/link";

import { ContactAvatar } from "@/components/contact-avatar";
import { Window } from "@/components/window";
import type { UpcomingBirthday } from "@/lib/birthdays";
import { formatBirthdayRow } from "@/lib/format";

// Birthdays of the week above the list, styled like the contact list window. A row is one link to
// the card; unlike the "keep in touch" block there is nothing to check off.
export function BirthdaysBlock({ contacts }: { contacts: UpcomingBirthday[] }) {
  return (
    <section aria-label="Скоро день рождения">
      <Window
        title="скоро день рождения.exe"
        bar="butter"
        controls={3}
        aside={<span className="font-pixel text-8 text-ink sm:text-9">{contacts.length}</span>}
      >
        <ul className="divide-y-2 divide-dashed divide-lilac">
          {contacts.map((contact) => (
            <li key={contact.id}>
              <Link
                href={`/contacts/${contact.id}`}
                prefetch={false}
                className="flex min-w-0 items-center gap-3.5 px-4 py-3 hover:bg-paper focus-visible:bg-paper focus-visible:-outline-offset-3"
              >
                <ContactAvatar name={contact.name} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-16 font-semibold">{contact.name}</div>
                  <div className="text-14 text-ink-muted">{formatBirthdayRow(contact)}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Window>
    </section>
  );
}
