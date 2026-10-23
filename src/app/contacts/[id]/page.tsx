import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { addNote, deleteContact } from "@/app/actions";
import { BackLink } from "@/components/back-link";
import { ContactAvatar } from "@/components/contact-avatar";
import { DeleteContactButton } from "@/components/delete-contact-button";
import { NoteForm } from "@/components/note-form";
import { PixelIcon } from "@/components/pixel-icon";
import { Button } from "@/components/ui/button";
import { Window } from "@/components/window";
import { getContact, listNotes } from "@/db/queries";
import { formatNoteDate, pluralize } from "@/lib/format";
import { parseContactId } from "@/lib/ids";

// Always read fresh data from the database: any browser sees the same card
export const dynamic = "force-dynamic";

async function loadContact(params: PageProps<"/contacts/[id]">["params"]) {
  const id = parseContactId((await params).id);
  if (id === null) notFound();
  const contact = await getContact(id);
  if (!contact) notFound();
  return contact;
}

export async function generateMetadata({
  params,
}: PageProps<"/contacts/[id]">): Promise<Metadata> {
  const contact = await loadContact(params);
  return { title: contact.name };
}

export default async function ContactPage({ params }: PageProps<"/contacts/[id]">) {
  const contact = await loadContact(params);
  const notes = await listNotes(contact.id);

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <BackLink href="/">Все контакты</BackLink>

      <Window title="карточка" bar="butter" controls={2}>
        <div className="flex items-start gap-4 p-4 sm:gap-5 sm:p-6">
          <ContactAvatar name={contact.name} className="size-14 text-16" />
          <div className="min-w-0 flex-1 sm:pt-1">
            <h1 className="text-22 leading-heading font-bold break-words sm:text-26">
              {contact.name}
            </h1>
            {contact.about ? (
              <p className="mt-1.5 text-15 text-ink-muted sm:text-16">{contact.about}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 gap-2 sm:gap-3">
            <Button asChild variant="outline">
              <Link href={`/contacts/${contact.id}/edit`}>
                <PixelIcon name="pencil" />
                <span className="hidden sm:inline">Изменить</span>
                <span className="sr-only sm:hidden">Изменить контакт</span>
              </Link>
            </Button>
            <DeleteContactButton
              action={deleteContact.bind(null, contact.id)}
              name={contact.name}
              noteCount={notes.length}
            />
          </div>
        </div>
        <dl className="grid gap-x-6 gap-y-4 border-t-2 border-dashed border-lilac p-4 sm:grid-cols-[10rem_1fr] sm:p-6">
          <DetailRow label="Откуда знакомы">
            {contact.howWeMet ? (
              <span className="whitespace-pre-wrap">{contact.howWeMet}</span>
            ) : null}
          </DetailRow>
          <DetailRow label="Телефон">
            {contact.phone ? (
              <a
                href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}
                className="underline-offset-4 hover:underline"
              >
                {contact.phone}
              </a>
            ) : null}
          </DetailRow>
          <DetailRow label="Почта">
            {contact.email ? (
              <a
                href={`mailto:${contact.email}`}
                className="break-all underline-offset-4 hover:underline"
              >
                {contact.email}
              </a>
            ) : null}
          </DetailRow>
        </dl>
      </Window>

      <Window
        title="Заметки"
        heading
        bar="lilac"
        className="mt-2 sm:mt-3"
        aside={
          notes.length > 0 ? (
            <span className="font-pixel text-8 text-ink-soft sm:text-9">
              {notes.length} {pluralize(notes.length, ["заметка", "заметки", "заметок"])}
            </span>
          ) : null
        }
      >
        <div className="flex flex-col gap-6 p-4 sm:p-6">
          <NoteForm action={addNote.bind(null, contact.id)} />

          {notes.length === 0 ? (
            <p className="text-14 text-ink-muted">
              Заметок пока нет. Запишите, о чём поговорили и о чём договорились.
            </p>
          ) : (
            <ol className="flex flex-col divide-y-2 divide-dashed divide-lilac border-t-2 border-dashed border-lilac">
              {notes.map((note) => (
                <li key={note.id} className="py-4 last:pb-0">
                  <time
                    dateTime={note.createdAt.toISOString()}
                    className="font-pixel text-8 text-ink-faint sm:text-9"
                  >
                    {formatNoteDate(note.createdAt)}
                  </time>
                  <p className="mt-2 text-15 leading-body whitespace-pre-wrap break-words text-ink-soft sm:text-16">
                    {note.body}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </Window>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="contents">
      <dt className="font-pixel text-9 leading-normal text-ink-faint sm:pt-1">{label}</dt>
      <dd className="-mt-2 text-16 sm:mt-0">
        {children ?? <span className="text-ink-faint">Не указано</span>}
      </dd>
    </div>
  );
}
