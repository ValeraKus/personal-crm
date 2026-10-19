import Link from "next/link";

import { PixelIcon } from "@/components/pixel-icon";

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 w-fit max-w-full items-center gap-2.5 font-pixel text-9 text-ink-soft underline-offset-4 hover:text-ink hover:underline sm:text-10"
    >
      <PixelIcon name="arrow-right" className="size-3 -scale-x-100 text-violet" />
      <span className="truncate leading-normal">{children}</span>
    </Link>
  );
}
