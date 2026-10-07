"use client";

import { startTransition, useActionState, useEffect, useRef, type FormEvent } from "react";
import { toast } from "sonner";

import type { NoteFormState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

type NoteFormProps = {
  action: (state: NoteFormState, formData: FormData) => Promise<NoteFormState>;
};

export function NoteForm({ action }: NoteFormProps) {
  const [state, formAction, isPending] = useActionState(action, { status: "idle" });
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the field only after the note is really saved, so text is not lost on errors
  useEffect(() => {
    if (state.status === "saved") {
      formRef.current?.reset();
      toast.success("Заметка сохранена", { id: state.savedAt });
    }
  }, [state]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  const error = state.status === "error" ? state.message : null;

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-3"
    >
      <Field data-invalid={Boolean(error)}>
        <FieldLabel htmlFor="note-body" className="sr-only">
          Новая заметка
        </FieldLabel>
        <Textarea
          id="note-body"
          name="body"
          rows={3}
          placeholder="О чём поговорили, о чём договорились"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "note-body-error" : undefined}
          onKeyDown={(event) => {
            // Cmd+Enter / Ctrl+Enter saves the note
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        {error ? <FieldError id="note-body-error">{error}</FieldError> : null}
      </Field>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? <Spinner /> : null}
          {isPending ? "Сохраняю…" : "Добавить заметку"}
        </Button>
        <span className="hidden text-xs text-muted-foreground sm:inline">или ⌘ + Enter</span>
      </div>
    </form>
  );
}
