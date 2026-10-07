import { PencilIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { addNote } from "@/app/actions";
import { BackLink } from "@/components/back-link";
import { ContactAvatar } from "@/components/contact-avatar";
import { NoteForm } from "@/components/note-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="flex flex-col gap-4">
      <BackLink href="/">Все контакты</BackLink>

      <Card>
        <CardHeader className="flex flex-row items-start gap-4">
          <ContactAvatar name={contact.name} className="size-14 text-lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight break-words">{contact.name}</h1>
            {contact.about ? (
              <p className="mt-0.5 text-muted-foreground">{contact.about}</p>
            ) : null}
          </div>
          <Button asChild variant="outline">
            <Link href={`/contacts/${contact.id}/edit`}>
              <PencilIcon data-icon="inline-start" />
              <span className="hidden sm:inline">Изменить</span>
              <span className="sr-only sm:hidden">Изменить контакт</span>
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-[10rem_1fr]">
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Заметки
            {notes.length > 0 ? (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {notes.length} {pluralize(notes.length, ["заметка", "заметки", "заметок"])}
              </span>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <NoteForm action={addNote.bind(null, contact.id)} />

          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Заметок пока нет. Запишите, о чём поговорили и о чём договорились.
            </p>
          ) : (
            <ol className="flex flex-col gap-4">
              {notes.map((note) => (
                <li key={note.id} className="border-l-2 pl-4">
                  <time
                    dateTime={note.createdAt.toISOString()}
                    className="text-xs text-muted-foreground"
                  >
                    {formatNoteDate(note.createdAt)}
                  </time>
                  <p className="mt-1 whitespace-pre-wrap break-words">{note.body}</p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="contents">
      <dt className="text-sm text-muted-foreground sm:pt-0.5">{label}</dt>
      <dd className="-mt-3 sm:mt-0">
        {children ?? <span className="text-muted-foreground">Не указано</span>}
      </dd>
    </div>
  );
}
