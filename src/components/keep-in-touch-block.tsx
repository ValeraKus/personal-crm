import Link from "next/link";

import { ContactAvatar } from "@/components/contact-avatar";
import { MarkContactedButton } from "@/components/mark-contacted-button";
import { Window } from "@/components/window";
import { formatOverdue } from "@/lib/format";
import type { OverdueContact } from "@/lib/keep-in-touch";

// Overdue contacts above the list, styled like the contact list window
export function KeepInTouchBlock({ contacts }: { contacts: OverdueContact[] }) {
  return (
    <section aria-label="Пора связаться">
      <Window
        title="пора связаться.exe"
        bar="accent"
        controls={3}
        aside={<span className="font-pixel text-8 text-ink sm:text-9">{contacts.length}</span>}
      >
        <ul className="divide-y-2 divide-dashed divide-lilac">
          {contacts.map((contact) => (
            <li key={contact.id} className="flex items-center gap-3.5 pr-4">
              <Link
                href={`/contacts/${contact.id}`}
                prefetch={false}
                className="flex min-w-0 flex-1 items-center gap-3.5 py-3 pl-4 hover:bg-paper focus-visible:bg-paper focus-visible:-outline-offset-3"
              >
                <ContactAvatar name={contact.name} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-16 font-semibold">{contact.name}</div>
                  <div className="text-14 text-ink-muted">
                    {contact.label} ·{" "}
                    <span className="text-danger">{formatOverdue(contact.overdueDays)}</span>
                  </div>
                </div>
              </Link>
              <MarkContactedButton contactId={contact.id} name={contact.name} variant="row" />
            </li>
          ))}
        </ul>
      </Window>
    </section>
  );
}
