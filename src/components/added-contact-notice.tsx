"use client";

import { useEffect } from "react";
import { toast } from "sonner";

// After a contact is created the list opens with ?added=<id> on the page where the contact stands:
// scroll to the new row, say it was added, and put the address of that page instead of ?added=,
// so a reload shows the same page without the notice
export function AddedContactNotice({
  contactId,
  name,
  listHref,
}: {
  contactId: number;
  name: string;
  listHref: string;
}) {
  useEffect(() => {
    // Wait a frame: Next.js scrolls the page to the top after navigation, which would undo ours
    const frame = requestAnimationFrame(() => {
      document.getElementById(`contact-${contactId}`)?.scrollIntoView({ block: "center" });
    });
    toast.success(`Контакт «${name}» добавлен`, { id: `added-${contactId}` });
    window.history.replaceState(null, "", listHref);
    return () => cancelAnimationFrame(frame);
  }, [contactId, name, listHref]);

  return null;
}
