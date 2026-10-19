import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { updateContact } from "@/app/actions";
import { BackLink } from "@/components/back-link";
import { ContactForm } from "@/components/contact-form";
import { Window } from "@/components/window";
import { getContact } from "@/db/queries";
import { parseContactId } from "@/lib/ids";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Изменить контакт",
};

export default async function EditContactPage({ params }: PageProps<"/contacts/[id]/edit">) {
  const id = parseContactId((await params).id);
  if (id === null) notFound();
  const contact = await getContact(id);
  if (!contact) notFound();

  const cardHref = `/contacts/${contact.id}`;

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <BackLink href={cardHref}>{contact.name}</BackLink>
      <h1 className="font-display text-26 leading-heading uppercase sm:text-38">Изменить контакт</h1>
      <Window title="карточка" bar="butter" controls={2} className="mt-2">
        <div className="p-4 sm:p-6">
          <ContactForm
            action={updateContact.bind(null, contact.id)}
            defaultValues={contact}
            submitLabel="Сохранить"
            cancelHref={cardHref}
          />
        </div>
      </Window>
    </div>
  );
}
