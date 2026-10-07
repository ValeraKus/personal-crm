"use client";

import { useEffect } from "react";
import { toast } from "sonner";

// After a contact is created the list opens with ?added=<id>:
// scroll to the new row, say it was added, and drop the parameter from the address
export function AddedContactNotice({ contactId, name }: { contactId: number; name: string }) {
  useEffect(() => {
    // Wait a frame: Next.js scrolls the page to the top after navigation, which would undo ours
    const frame = requestAnimationFrame(() => {
      document.getElementById(`contact-${contactId}`)?.scrollIntoView({ block: "center" });
    });
    toast.success(`Контакт «${name}» добавлен`, { id: `added-${contactId}` });
    window.history.replaceState(null, "", "/");
    return () => cancelAnimationFrame(frame);
  }, [contactId, name]);

  return null;
}
