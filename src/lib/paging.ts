// Contacts are listed in parts. What is open lives in the address: `page` is the first open page,
// `to` is the last one after "Загрузить ещё" added more pages below.

export const CONTACTS_PAGE_SIZE = 100;

// How many pages the contacts make; an empty list is still one (empty) page
export function pageCount(total: number) {
  return Math.max(1, Math.ceil(total / CONTACTS_PAGE_SIZE));
}

export type PageRange = { first: number; last: number; pageCount: number };

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

// A whole number from 1 up; anything else (letters, 0, minus, a fraction) is not a page
function parsePageNumber(value: string | string[] | undefined): number | null {
  const text = firstValue(value);
  if (text === undefined || !/^\d{1,9}$/.test(text)) return null;
  const number = Number(text);
  return number >= 1 ? number : null;
}

// The pages to show for `page` and `to` of the address and the number of found contacts.
// A page past the end is the last page; a wrong page is the first; a wrong `to` is `page` itself.
export function parsePageRange(
  page: string | string[] | undefined,
  to: string | string[] | undefined,
  total: number,
): PageRange {
  const count = pageCount(total);
  const first = Math.min(parsePageNumber(page) ?? 1, count);
  const requestedLast = parsePageNumber(to);
  const last =
    requestedLast === null || requestedLast < first ? first : Math.min(requestedLast, count);
  return { first, last, pageCount: count };
}

export type PageItem = { page: number } | "gap";

// The row of the switcher: the first and the last page, the open pages and `neighbors` pages on
// each side of them. "…" stands for two pages or more that are left out; a single left-out page
// is shown as a number, so "…" never hides one page. A phone shows a row without neighbors.
export function pageItems(
  first: number,
  last: number,
  total: number,
  neighbors: number,
): PageItem[] {
  const shown = new Set<number>([1, total]);
  for (let page = first - neighbors; page <= last + neighbors; page += 1) {
    if (page >= 1 && page <= total) shown.add(page);
  }

  const pages = [...shown].sort((a, b) => a - b);
  const items: PageItem[] = [];
  pages.forEach((page, index) => {
    const previous = pages[index - 1];
    if (previous !== undefined) {
      const skipped = page - previous - 1;
      if (skipped === 1) items.push({ page: previous + 1 });
      else if (skipped > 1) items.push("gap");
    }
    items.push({ page });
  });
  return items;
}
