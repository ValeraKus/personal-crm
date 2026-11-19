import { describe, expect, it } from "vitest";

import { CONTACTS_PAGE_SIZE, pageCount, pageItems, parsePageRange } from "@/lib/paging";

// Rules of the requirements "Страница в адресе" and "Переключатель страниц" in
// openspec/changes/paging/specs/contact-list-paging/spec.md.
// Which contacts the database returns for a page is checked in src/db/paging.db.test.ts.

describe("CONTACTS_PAGE_SIZE", () => {
  it("is 100 contacts per page", () => {
    expect(CONTACTS_PAGE_SIZE).toBe(100);
  });
});

describe("pageCount", () => {
  it("is one page for no contacts", () => {
    expect(pageCount(0)).toBe(1);
  });

  it("is one page for exactly 100 contacts", () => {
    expect(pageCount(100)).toBe(1);
  });

  it("starts a new page with the 101st contact", () => {
    expect(pageCount(101)).toBe(2);
    expect(pageCount(250)).toBe(3);
    expect(pageCount(1000)).toBe(10);
  });
});

describe("parsePageRange", () => {
  it("is the first page when the address has no page", () => {
    expect(parsePageRange(undefined, undefined, 250)).toEqual({ first: 1, last: 1, pageCount: 3 });
  });

  it("opens the page from the address", () => {
    expect(parsePageRange("2", undefined, 250)).toEqual({ first: 2, last: 2, pageCount: 3 });
  });

  it("opens the last page when the page is past the end", () => {
    expect(parsePageRange("99", undefined, 250)).toEqual({ first: 3, last: 3, pageCount: 3 });
  });

  it.each(["abc", "0", "-1", "2.5", "", "1e1", " 2", "٣"])(
    "opens the first page for the page %j",
    (value) => {
      expect(parsePageRange(value, undefined, 250)).toEqual({ first: 1, last: 1, pageCount: 3 });
    },
  );

  it("takes the first of a repeated page parameter", () => {
    expect(parsePageRange(["2", "3"], undefined, 250)).toEqual({
      first: 2,
      last: 2,
      pageCount: 3,
    });
  });

  it("opens the pages from `page` to `to`", () => {
    expect(parsePageRange("3", "4", 1000)).toEqual({ first: 3, last: 4, pageCount: 10 });
  });

  it("opens only `page` when `to` is less than it", () => {
    expect(parsePageRange("3", "2", 1000)).toEqual({ first: 3, last: 3, pageCount: 10 });
  });

  it("opens only `page` when `to` is not a number", () => {
    expect(parsePageRange("3", "abc", 1000)).toEqual({ first: 3, last: 3, pageCount: 10 });
    expect(parsePageRange("3", "0", 1000)).toEqual({ first: 3, last: 3, pageCount: 10 });
  });

  it("opens up to the last page when `to` is past the end", () => {
    expect(parsePageRange("2", "99", 250)).toEqual({ first: 2, last: 3, pageCount: 3 });
  });

  it("starts from `page` when `to` is given without it", () => {
    expect(parsePageRange(undefined, "2", 250)).toEqual({ first: 1, last: 2, pageCount: 3 });
  });

  it("is one page when there are no contacts", () => {
    expect(parsePageRange("5", "7", 0)).toEqual({ first: 1, last: 1, pageCount: 1 });
  });
});

describe("pageItems with one neighbour (a computer)", () => {
  const page = (number: number) => ({ page: number });

  it("shows every page of a short list", () => {
    expect(pageItems(1, 1, 3, 1)).toEqual([page(1), page(2), page(3)]);
  });

  it("shows the first, the neighbours, the open page and the last", () => {
    expect(pageItems(5, 5, 10, 1)).toEqual([
      page(1),
      "gap",
      page(4),
      page(5),
      page(6),
      "gap",
      page(10),
    ]);
  });

  it("shows a page instead of a gap of one page", () => {
    // 1 2 3 4 … 10: page 2 is not hidden behind "…"
    expect(pageItems(3, 3, 10, 1)).toEqual([page(1), page(2), page(3), page(4), "gap", page(10)]);
    expect(pageItems(8, 8, 10, 1)).toEqual([page(1), "gap", page(7), page(8), page(9), page(10)]);
  });

  it("shows the neighbour of the last open page", () => {
    expect(pageItems(1, 2, 10, 1)).toEqual([page(1), page(2), page(3), "gap", page(10)]);
  });

  it("shows every open page", () => {
    expect(pageItems(3, 4, 10, 1)).toEqual([
      page(1),
      page(2),
      page(3),
      page(4),
      page(5),
      "gap",
      page(10),
    ]);
  });

  it("is a single number for a single page", () => {
    expect(pageItems(1, 1, 1, 1)).toEqual([page(1)]);
  });
});

describe("pageItems without neighbours (a phone)", () => {
  const page = (number: number) => ({ page: number });

  it("shows only the first, the open page and the last", () => {
    expect(pageItems(5, 5, 10, 0)).toEqual([page(1), "gap", page(5), "gap", page(10)]);
  });

  it("shows a page instead of a gap of one page", () => {
    // 1 2 3 … 10, not 1 … 3 … 10
    expect(pageItems(3, 3, 10, 0)).toEqual([page(1), page(2), page(3), "gap", page(10)]);
    // 1 … 8 9 10, not 1 … 8 … 10
    expect(pageItems(8, 8, 10, 0)).toEqual([page(1), "gap", page(8), page(9), page(10)]);
  });

  it("shows every open page, even when there are many", () => {
    expect(pageItems(1, 5, 10, 0)).toEqual([
      page(1),
      page(2),
      page(3),
      page(4),
      page(5),
      "gap",
      page(10),
    ]);
  });

  it("is a single number for a single page", () => {
    expect(pageItems(1, 1, 1, 0)).toEqual([page(1)]);
  });

  it("shows every page of a short list", () => {
    expect(pageItems(2, 2, 3, 0)).toEqual([page(1), page(2), page(3)]);
  });
});
