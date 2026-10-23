"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import type { DeleteContactState } from "@/app/actions";
import { PixelIcon } from "@/components/pixel-icon";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Window } from "@/components/window";
import { pluralize } from "@/lib/format";

type DeleteContactButtonProps = {
  action: (state: DeleteContactState) => Promise<DeleteContactState>;
  name: string;
  noteCount: number;
};

export function DeleteContactButton({ action, name, noteCount }: DeleteContactButtonProps) {
  const [state, deleteAction, isPending] = useActionState(action, { status: "idle" });
  const [open, setOpen] = useState(false);
  // An error stays in the action state until the next attempt: hide it once the dialog is closed
  const [closedOn, setClosedOn] = useState<DeleteContactState>();
  const router = useRouter();

  // Stay busy after the deletion too, until the list replaces this page
  const busy = isPending || state.status === "deleted";
  const error = state.status === "error" && state !== closedOn ? state.message : null;

  // Replace, not push: "Back" must not lead to the card of the deleted contact
  useEffect(() => {
    if (state.status === "deleted") {
      toast.success(`Контакт «${name}» удалён`);
      router.replace("/");
    }
  }, [state, name, router]);

  function handleOpenChange(nextOpen: boolean) {
    if (busy) return;
    if (!nextOpen) setClosedOn(state);
    setOpen(nextOpen);
  }

  const description =
    noteCount > 0
      ? `«${name}» и ${noteCount} ${pluralize(noteCount, ["заметка", "заметки", "заметок"])} удалятся насовсем, вернуть будет нельзя.`
      : `«${name}» удалится насовсем, вернуть будет нельзя.`;

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">
          <PixelIcon name="trash" />
          <span className="hidden sm:inline">Удалить</span>
          <span className="sr-only sm:hidden">Удалить контакт</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <Window title="удаление" bar="accent" controls={2}>
          <div className="flex flex-col gap-5 p-4 sm:p-6">
            <AlertDialogHeader>
              <AlertDialogTitle>Удалить контакт?</AlertDialogTitle>
              <AlertDialogDescription className="break-words">{description}</AlertDialogDescription>
            </AlertDialogHeader>

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Отмена</AlertDialogCancel>
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() => startTransition(() => deleteAction())}
              >
                {busy ? <Spinner /> : <PixelIcon name="trash" />}
                {busy ? "Удаляю…" : "Удалить"}
              </Button>
            </AlertDialogFooter>
          </div>
        </Window>
      </AlertDialogContent>
    </AlertDialog>
  );
}
