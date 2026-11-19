import Link from "next/link";

import { LoadMoreSpinner } from "@/components/load-more-spinner";
import { PixelIcon } from "@/components/pixel-icon";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatShownRange } from "@/lib/format";
import { contactListHref } from "@/lib/group-filter";
import { CONTACTS_PAGE_SIZE, pageItems, type PageItem } from "@/lib/paging";
import { cn } from "@/lib/utils";

type PagerProps = {
  query: string;
  groupIds: number[];
  // The open pages: from `first` to `last`
  first: number;
  last: number;
  pageCount: number;
  // How many contacts the list has for this search and these groups
  found: number;
};

// The bottom of the list: the page switcher and the caption under it. A computer shows the
// neighbours of the open pages, a phone does not, so the row fits the width; both rows are in the
// markup, and the one that does not fit the screen is hidden (and so is not read out).
export function ContactListPager({ query, groupIds, first, last, pageCount, found }: PagerProps) {
  const href = (from: number, to: number = from) =>
    contactListHref(query, groupIds, { first: from, last: to });

  return (
    <div className="flex flex-col items-center gap-4 border-t-2 border-ink px-4 py-5">
      {last < pageCount ? (
        // Adds the next hundred under the open ones: replace, so "Back" leaves the list instead
        // of undoing the loads one by one; no scrolling, so the screen stays where it is
        <Button asChild variant="outline">
          <Link href={href(first, last + 1)} replace scroll={false} prefetch={false}>
            Загрузить ещё
            <LoadMoreSpinner />
          </Link>
        </Button>
      ) : null}
      <nav aria-label="Страницы">
        <ul className="flex flex-wrap items-center justify-center gap-2">
          <li>
            <Arrow
              label="Предыдущая страница"
              direction="previous"
              href={first > 1 ? href(first - 1) : null}
            />
          </li>
          <PageItems
            items={pageItems(first, last, pageCount, 1)}
            first={first}
            last={last}
            href={href}
            className="hidden sm:block"
          />
          <PageItems
            items={pageItems(first, last, pageCount, 0)}
            first={first}
            last={last}
            href={href}
            className="sm:hidden"
          />
          <li>
            <Arrow
              label="Следующая страница"
              direction="next"
              href={last < pageCount ? href(last + 1) : null}
            />
          </li>
        </ul>
      </nav>
      <p className="font-pixel text-9 text-ink-faint sm:text-10">
        {formatShownRange(
          (first - 1) * CONTACTS_PAGE_SIZE + 1,
          Math.min(last * CONTACTS_PAGE_SIZE, found),
          found,
        )}
      </p>
    </div>
  );
}

function PageItems({
  items,
  first,
  last,
  href,
  className,
}: {
  items: PageItem[];
  first: number;
  last: number;
  href: (from: number, to?: number) => string;
  className: string;
}) {
  return items.map((item, index) => {
    if (item === "gap") {
      return (
        <li key={`gap-${index}`} className={cn("font-pixel text-9 text-ink-muted", className)}>
          …
        </li>
      );
    }
    // An open page is marked; pressing any number opens that page alone
    const open = item.page >= first && item.page <= last;
    return (
      <li key={item.page} className={className}>
        <Button asChild size="sm" variant={open ? "default" : "outline"} className="min-w-9 px-2">
          <Link
            href={href(item.page)}
            prefetch={false}
            aria-label={`Страница ${item.page}`}
            aria-current={open ? "page" : undefined}
          >
            {item.page}
          </Link>
        </Button>
      </li>
    );
  });
}

// A link to the page before or after the open ones; without a page it is shown but does not work
function Arrow({
  label,
  direction,
  href,
}: {
  label: string;
  direction: "previous" | "next";
  href: string | null;
}) {
  const icon = (
    <PixelIcon
      name="arrow-right"
      className={cn("size-3", direction === "previous" && "-scale-x-100")}
    />
  );
  if (href === null) {
    return (
      <span
        role="link"
        aria-disabled="true"
        aria-label={label}
        className={cn(
          buttonVariants({ variant: "outline", size: "icon-sm" }),
          "pointer-events-none opacity-50",
        )}
      >
        {icon}
      </span>
    );
  }
  return (
    <Button asChild variant="outline" size="icon-sm">
      <Link href={href} prefetch={false} aria-label={label}>
        {icon}
      </Link>
    </Button>
  );
}
