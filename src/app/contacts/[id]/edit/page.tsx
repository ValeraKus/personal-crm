import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { updateContact } from "@/app/actions";
import { BackLink } from "@/components/back-link";
import { ContactForm } from "@/components/contact-form";
import { Card, CardContent } from "@/components/ui/card";
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
    <div className="flex flex-col gap-4">
      <BackLink href={cardHref}>{contact.name}</BackLink>
      <h1 className="text-2xl font-semibold tracking-tight">Изменить контакт</h1>
      <Card>
        <CardContent>
          <ContactForm
            action={updateContact.bind(null, contact.id)}
            defaultValues={contact}
            submitLabel="Сохранить"
            cancelHref={cardHref}
          />
        </CardContent>
      </Card>
    </div>
  );
}
