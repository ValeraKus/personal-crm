"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { toast } from "sonner";

import {
  deleteGroup,
  renameGroup,
  type DeleteGroupState,
  type RenameGroupState,
} from "@/app/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Window } from "@/components/window";
import { formatContactCount, pluralize } from "@/lib/format";

type GroupRowProps = { id: number; name: string; contactCount: number };

export function GroupRow({ id, name, contactCount }: GroupRowProps) {
  const [editing, setEditing] = useState(false);

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
      {editing ? (
        <RenameForm id={id} name={name} onDone={() => setEditing(false)} />
      ) : (
        <>
          <div className="min-w-0 flex-1">
            <Link
              href={`/?group=${id}`}
              className="text-16 font-semibold break-words underline-offset-4 hover:underline"
            >
              {name}
            </Link>
            <div className="text-14 text-ink-muted">{formatContactCount(contactCount)}</div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing(true)}>
              Переименовать
            </Button>
            <DeleteGroupButton id={id} name={name} contactCount={contactCount} />
          </div>
        </>
      )}
    </li>
  );
}

function RenameForm({ id, name, onDone }: { id: number; name: string; onDone: () => void }) {
  const [state, formAction, isPending] = useActionState(
    async (previous: RenameGroupState, formData: FormData) => {
      const next = await renameGroup(id, previous, formData);
      if (next.status === "renamed") onDone();
      return next;
    },
    { status: "idle" } as RenameGroupState,
  );
  const error = state.status === "error" ? state.message : undefined;
  // Controlled, so React does not reset the field to the old name after an error
  const [value, setValue] = useState(name);

  return (
    <form action={formAction} className="flex w-full flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Input
          name="name"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-label="Название группы"
          aria-invalid={error ? true : undefined}
          autoComplete="off"
          autoFocus
          className="min-w-0 flex-1"
        />
        <Button type="submit" disabled={isPending}>
          {isPending ? <Spinner /> : null}
          Сохранить
        </Button>
        <Button type="button" variant="ghost" onClick={onDone} disabled={isPending}>
          Отмена
        </Button>
      </div>
      {error ? <FieldError>{error}</FieldError> : null}
    </form>
  );
}

function DeleteGroupButton({ id, name, contactCount }: GroupRowProps) {
  const [open, setOpen] = useState(false);
  const [state, deleteAction, isPending] = useActionState(
    async (): Promise<DeleteGroupState> => {
      const next = await deleteGroup(id);
      if (next.status === "deleted") {
        setOpen(false);
        toast.success(`Группа «${name}» удалена`);
      }
      return next;
    },
    { status: "idle" } as DeleteGroupState,
  );
  const error = state.status === "error" ? state.message : null;

  const kept =
    contactCount > 0
      ? `, ${contactCount} ${pluralize(contactCount, ["контакт останется", "контакта останутся", "контактов останутся"])} без неё`
      : "";

  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Удалить
      </Button>
      <AlertDialog open={open} onOpenChange={(next) => !isPending && setOpen(next)}>
        <AlertDialogContent>
          <Window title="удаление" bar="accent" controls={2}>
            <div className="flex flex-col gap-5 p-4 sm:p-6">
              <AlertDialogHeader>
                <AlertDialogTitle>Удалить группу?</AlertDialogTitle>
                <AlertDialogDescription className="break-words">
                  Группа «{name}» удалится{kept}
                </AlertDialogDescription>
              </AlertDialogHeader>
              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>Отмена</AlertDialogCancel>
                <Button
                  variant="destructive"
                  disabled={isPending}
                  onClick={() => startTransition(() => deleteAction())}
                >
                  {isPending ? <Spinner /> : null}
                  {isPending ? "Удаляю…" : "Удалить"}
                </Button>
              </AlertDialogFooter>
            </div>
          </Window>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
