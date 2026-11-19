import { describe, expect, it } from "vitest";

import { rememberedListHref } from "@/lib/contact-list-memory";

// The address of the list that «Все контакты» goes back to is read from the browser's storage, so
// it is checked before it becomes a link: only the list itself is taken, never another address.
// «Возврат к списку по ссылке «Все контакты»» in
// openspec/changes/paging/specs/contact-list-paging/spec.md

describe("rememberedListHref", () => {
  it.each(["/", "/?page=5", "/?page=3&to=4", "/?q=%D0%BE%D0%B2&page=2", "/?group=3&group=7"])(
    "takes the address of the list %s",
    (href) => {
      expect(rememberedListHref(href)).toBe(href);
    },
  );

  it.each([null, undefined, "", "page=5"])("is the first page for the empty value %j", (value) => {
    expect(rememberedListHref(value)).toBe("/");
  });

  it.each([
    "//evil.example/?page=2",
    "https://evil.example/",
    "javascript:alert(1)",
    "/\\evil.example",
    "/contacts/5",
    "/groups",
    "/login?next=/",
  ])("is the first page for an address that is not the list: %s", (value) => {
    expect(rememberedListHref(value)).toBe("/");
  });
});
