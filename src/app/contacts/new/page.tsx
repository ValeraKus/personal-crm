import type { Metadata } from "next";

import { createContact } from "@/app/actions";
import { BackLink } from "@/components/back-link";
import { ContactForm } from "@/components/contact-form";
import { Window } from "@/components/window";
import { listGroups } from "@/db/queries";

export const metadata: Metadata = {
  title: "Новый контакт",
};

// Fresh groups on every open: a group made in another browser must show up
export const dynamic = "force-dynamic";

export default async function NewContactPage() {
  const groups = await listGroups();
  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <BackLink href="/">Все контакты</BackLink>
      <h1 className="font-display text-26 leading-heading uppercase sm:text-38">Новый контакт</h1>
      <Window title="карточка" bar="butter" controls={2} className="mt-2">
        <div className="p-4 sm:p-6">
          <ContactForm
            action={createContact}
            submitLabel="Добавить контакт"
            cancelHref="/"
            groups={groups}
          />
        </div>
      </Window>
    </div>
  );
}
