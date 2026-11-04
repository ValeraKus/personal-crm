import { describe, expect, it } from "vitest";

import {
  contactListHref,
  emptyFilterMessage,
  selectedGroupIds,
  toggleGroupId,
} from "@/lib/group-filter";

// Rules of the "Фильтр списка по группам" requirement in openspec/specs/contact-groups/spec.md.
// Which contacts the database returns for a choice is checked in e2e/contact-groups.spec.ts.

describe("toggleGroupId", () => {
  it("adds a group that is not selected", () => {
    expect(toggleGroupId([3], 7)).toEqual([3, 7]);
  });

  it("removes a group that is selected and keeps the others", () => {
    expect(toggleGroupId([3, 7], 3)).toEqual([7]);
  });

  it("selects nothing after the only selected group is pressed again", () => {
    expect(toggleGroupId([3], 3)).toEqual([]);
  });
});

describe("contactListHref", () => {
  it("is the plain list without a search and groups", () => {
    expect(contactListHref("", [])).toBe("/");
  });

  it("keeps one group in the address", () => {
    expect(contactListHref("", [3])).toBe("/?group=3");
  });

  it("keeps every selected group in the address", () => {
    expect(contactListHref("", [3, 7])).toBe("/?group=3&group=7");
  });

  it("keeps the search together with the groups", () => {
    const search = new URLSearchParams(contactListHref("Иван", [3]).slice(2));
    expect(search.get("q")).toBe("Иван");
    expect(search.getAll("group")).toEqual(["3"]);
  });

  it("keeps the search when the filter is reset", () => {
    const search = new URLSearchParams(contactListHref("Иван", []).slice(2));
    expect(search.get("q")).toBe("Иван");
    expect(search.getAll("group")).toEqual([]);
  });
});

describe("selectedGroupIds", () => {
  const groups = [{ id: 3 }, { id: 7 }];

  it("returns the groups from the address", () => {
    expect(selectedGroupIds(["7", "3"], groups)).toEqual([7, 3]);
  });

  it("ignores the number of a group that does not exist", () => {
    expect(selectedGroupIds("999", groups)).toEqual([]);
  });

  it("keeps the existing groups next to one that does not exist", () => {
    expect(selectedGroupIds(["3", "999"], groups)).toEqual([3]);
  });

  it("selects nothing without the parameter", () => {
    expect(selectedGroupIds(undefined, groups)).toEqual([]);
  });
});

describe("emptyFilterMessage", () => {
  it("says the only selected group is empty", () => {
    expect(emptyFilterMessage("", 1)).toBe("В этой группе пока нет контактов");
  });

  it("says several selected groups have no shared contacts", () => {
    expect(emptyFilterMessage("", 2)).toBe("Нет контактов, которые входят во все выбранные группы");
  });

  it.each([1, 2])("names the search with %i selected groups", (groupCount) => {
    expect(emptyFilterMessage("Иван", groupCount)).toBe(
      "Никого не нашли по запросу «Иван» в выбранных группах",
    );
  });
});
