// The list of contacts a tab of the browser showed last: «Все контакты» goes back to it. The address
// is kept in the storage of the tab (sessionStorage): every tab has its own, it is gone when the tab
// is closed, and nothing but this address is kept there.

export const CONTACT_LIST_STORAGE_KEY = "contactListHref";

// The stored value becomes a link, so only the list itself is taken: "/" with or without a query.
// Anything else (another page, another site, "//host") and an empty value is the first page.
export function rememberedListHref(value: string | null | undefined) {
  if (value === "/" || (typeof value === "string" && value.startsWith("/?"))) return value;
  return "/";
}
