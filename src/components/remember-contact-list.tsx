"use client";

import { useEffect } from "react";

import { CONTACT_LIST_STORAGE_KEY } from "@/lib/contact-list-memory";

// Sits on the list: remembers in this tab what the list shows (the page, the pages loaded, the
// search, the groups), so «Все контакты» can lead back to exactly this
export function RememberContactList({ href }: { href: string }) {
  useEffect(() => {
    try {
      sessionStorage.setItem(CONTACT_LIST_STORAGE_KEY, href);
    } catch {
      // The storage is blocked (a private window, site data off): the link leads to the first page
    }
  }, [href]);

  return null;
}
