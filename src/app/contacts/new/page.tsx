import type { Metadata } from "next";

import { createContact } from "@/app/actions";
import { BackLink } from "@/components/back-link";
import { ContactForm } from "@/components/contact-form";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Новый контакт",
};

export default function NewContactPage() {
  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/">Все контакты</BackLink>
      <h1 className="text-2xl font-semibold tracking-tight">Новый контакт</h1>
      <Card>
        <CardContent>
          <ContactForm action={createContact} submitLabel="Добавить контакт" cancelHref="/" />
        </CardContent>
      </Card>
    </div>
  );
}
