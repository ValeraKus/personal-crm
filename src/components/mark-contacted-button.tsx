"use client";

import { useState } from "react";
import { toast } from "sonner";

import { markContacted, undoMarkContacted } from "@/app/actions";
import { PixelIcon } from "@/components/pixel-icon";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { CONTACTED_NOTE } from "@/lib/keep-in-touch";
import { cn } from "@/lib/utils";

type MarkContactedButtonProps = {
  contactId: number;
  name: string;
  // "row": square check in a row of the home block; "card": check with a caption on desktop
  variant: "row" | "card";
};

const UNDO_TOAST_MS = 5000;

export function MarkContactedButton({ contactId, name, variant }: MarkContactedButtonProps) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    // Disabled while running, so a double click cannot add two notes
    setPending(true);
    try {
      const result = await markContacted(contactId);
      if (result.status === "error") {
        toast.error("Не удалось отметить");
        return;
      }
      toast(`${result.name}: отмечено «${CONTACTED_NOTE}»`, {
        duration: UNDO_TOAST_MS,
        action: { label: "Отменить", onClick: () => void undo(result.noteId) },
      });
    } catch {
      toast.error("Не удалось отметить");
    } finally {
      setPending(false);
    }
  }

  async function undo(noteId: number) {
    try {
      const result = await undoMarkContacted(noteId);
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      toast("Отметка отменена");
    } catch {
      toast.error("Не удалось отменить");
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size={variant === "row" ? "icon" : "default"}
      disabled={pending}
      onClick={handleClick}
      className={cn(variant === "row" && "size-11")}
    >
      {pending ? <Spinner /> : <PixelIcon name="check" className="size-3" />}
      {variant === "card" ? <span className="hidden sm:inline">{CONTACTED_NOTE}</span> : null}
      <span className="sr-only">{`${CONTACTED_NOTE}: ${name}`}</span>
    </Button>
  );
}
