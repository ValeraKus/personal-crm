"use client";

import Link from "next/link";
import { startTransition, useActionState, type FormEvent } from "react";

import type { ContactFormState } from "@/app/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { ContactField } from "@/lib/validation";

type ContactFormProps = {
  action: (state: ContactFormState, formData: FormData) => Promise<ContactFormState>;
  defaultValues?: Partial<Record<ContactField, string | null>>;
  submitLabel: string;
  cancelHref: string;
};

export function ContactForm({ action, defaultValues, submitLabel, cancelHref }: ContactFormProps) {
  const [state, formAction, isPending] = useActionState(action, {});

  // Submit manually so React does not clear the fields when the server returns errors.
  // `action` on the form still works if the page is submitted before JavaScript loads.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  function fieldProps(name: ContactField) {
    const error = state.fieldErrors?.[name];
    return {
      id: name,
      name,
      defaultValue: defaultValues?.[name] ?? "",
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error ? `${name}-error` : undefined,
    };
  }

  function errorFor(name: ContactField) {
    const error = state.fieldErrors?.[name];
    return error ? <FieldError id={`${name}-error`}>{error}</FieldError> : null;
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      {state.formError ? (
        <Alert variant="destructive">
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      ) : null}

      <FieldGroup>
        <Field data-invalid={Boolean(state.fieldErrors?.name)}>
          <FieldLabel htmlFor="name">Имя и фамилия *</FieldLabel>
          <Input {...fieldProps("name")} required autoFocus autoComplete="off" />
          {errorFor("name")}
        </Field>

        <Field data-invalid={Boolean(state.fieldErrors?.about)}>
          <FieldLabel htmlFor="about">Кто это</FieldLabel>
          <Input
            {...fieldProps("about")}
            placeholder="Например: дизайнер в студии, сосед по даче"
            autoComplete="off"
          />
          {errorFor("about")}
        </Field>

        <Field data-invalid={Boolean(state.fieldErrors?.howWeMet)}>
          <FieldLabel htmlFor="howWeMet">Откуда знакомы</FieldLabel>
          <Textarea
            {...fieldProps("howWeMet")}
            placeholder="Где и когда познакомились, через кого"
            rows={3}
          />
          {errorFor("howWeMet")}
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field data-invalid={Boolean(state.fieldErrors?.phone)}>
            <FieldLabel htmlFor="phone">Телефон</FieldLabel>
            <Input
              {...fieldProps("phone")}
              type="tel"
              inputMode="tel"
              placeholder="+7 900 123-45-67"
              autoComplete="off"
            />
            {errorFor("phone")}
          </Field>

          <Field data-invalid={Boolean(state.fieldErrors?.email)}>
            <FieldLabel htmlFor="email">Почта</FieldLabel>
            <Input
              {...fieldProps("email")}
              type="email"
              placeholder="name@example.com"
              autoComplete="off"
            />
            {errorFor("email")}
          </Field>
        </div>
      </FieldGroup>

      <div className="flex gap-2">
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? <Spinner /> : null}
          {isPending ? "Сохраняю…" : submitLabel}
        </Button>
        <Button type="button" variant="ghost" size="lg" asChild>
          <Link href={cancelHref}>Отмена</Link>
        </Button>
      </div>
    </form>
  );
}
