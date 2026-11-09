"use client";

import { startTransition, useActionState, type FormEvent } from "react";

import type { LoginFormState } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

type LoginFormProps = {
  action: (state: LoginFormState, formData: FormData) => Promise<LoginFormState>;
};

export function LoginForm({ action }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(action, { status: "idle" });

  // A form submitted before the page is ready would reload it: send it as an action instead
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  const error = state.status === "error" ? state.message : null;

  return (
    <form action={formAction} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <Field data-invalid={Boolean(error)}>
        <FieldLabel htmlFor="login-email">Почта</FieldLabel>
        <Input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "login-email-error" : undefined}
        />
        {error ? <FieldError id="login-email-error">{error}</FieldError> : null}
      </Field>
      <Button type="submit" disabled={isPending} className="w-full sm:w-auto sm:self-start">
        {isPending ? <Spinner /> : null}
        {isPending ? "Отправляю…" : "Получить ссылку"}
      </Button>
      {state.status === "sent" ? (
        <p role="status" className="text-15 leading-body text-ink-soft">
          Ссылка для входа отправлена на {state.email}
        </p>
      ) : null}
    </form>
  );
}
