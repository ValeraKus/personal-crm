"use client";

import { useSyncExternalStore } from "react";

import { BackLink } from "@/components/back-link";
import { CONTACT_LIST_STORAGE_KEY, rememberedListHref } from "@/lib/contact-list-memory";

// The storage of the tab changes only on the list, never while this link is on the screen
const subscribe = () => () => {};

function readHref() {
  try {
    return rememberedListHref(sessionStorage.getItem(CONTACT_LIST_STORAGE_KEY));
  } catch {
    return "/";
  }
}

// «Все контакты» of the card, the form of a new contact and the page «Группы»: back to the list as
// this tab left it. The server and the first paint say "/", then the browser puts its address.
export function ContactListBackLink() {
  const href = useSyncExternalStore(subscribe, readHref, () => "/");
  return <BackLink href={href}>Все контакты</BackLink>;
}
