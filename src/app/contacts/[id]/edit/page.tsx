import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { updateContact } from "@/app/actions";
import { BackLink } from "@/components/back-link";
import { ContactForm } from "@/components/contact-form";
import { Window } from "@/components/window";
import { getContact, listContactGroups, listGroups } from "@/db/queries";
import { parseContactId } from "@/lib/ids";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Изменить контакт",
};

export default async function EditContactPage({ params }: PageProps<"/contacts/[id]/edit">) {
  const user = await requireUser();
  const id = parseContactId((await params).id);
  if (id === null) notFound();
  // A contact of somebody else is not found, the same as one that does not exist
  const contact = await getContact(user.id, id);
  if (!contact) notFound();

  const [groups, contactGroups] = await Promise.all([
    listGroups(user.id),
    listContactGroups(user.id, contact.id),
  ]);

  const cardHref = `/contacts/${contact.id}`;

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <BackLink href={cardHref}>{contact.name}</BackLink>
      <h1 className="font-display text-26 leading-heading uppercase sm:text-38">
        Изменить контакт
      </h1>
      <Window title="карточка" bar="butter" controls={2} className="mt-2">
        <div className="p-4 sm:p-6">
          <ContactForm
            action={updateContact.bind(null, contact.id)}
            defaultValues={{
              ...contact,
              // The "days" field is shown only for the custom term
              keepInTouchDays: contact.keepInTouchDays?.toString(),
            }}
            submitLabel="Сохранить"
            cancelHref={cardHref}
            groups={groups}
            defaultGroupIds={contactGroups.map((group) => group.id)}
          />
        </div>
      </Window>
    </div>
  );
}
