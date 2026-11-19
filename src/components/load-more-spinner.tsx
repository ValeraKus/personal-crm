"use client";

import { useLinkStatus } from "next/link";

import { Spinner } from "@/components/ui/spinner";

// Goes inside the «Загрузить ещё» link: spins while the next hundred contacts are coming
export function LoadMoreSpinner() {
  const { pending } = useLinkStatus();
  return pending ? <Spinner className="size-3" /> : null;
}
