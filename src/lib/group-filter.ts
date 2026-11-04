import { parseGroupIds } from "@/lib/ids";

// Group ids from the address: ids that match no existing group are ignored
export function selectedGroupIds(value: string | string[] | undefined, groups: { id: number }[]) {
  const knownIds = new Set(groups.map((group) => group.id));
  return parseGroupIds(value).filter((id) => knownIds.has(id));
}

// The choice after a group button is pressed: the button turns its group on or off
export function toggleGroupId(selectedIds: number[], id: number) {
  return selectedIds.includes(id)
    ? selectedIds.filter((selectedId) => selectedId !== id)
    : [...selectedIds, id];
}

// Address of the contact list with this search and this choice of groups
export function contactListHref(query: string, groupIds: number[]) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  for (const id of groupIds) params.append("group", String(id));
  const search = params.toString();
  return search ? `/?${search}` : "/";
}

// What the empty list says while at least one group is selected
export function emptyFilterMessage(query: string, groupCount: number) {
  if (query) return `Никого не нашли по запросу «${query}» в выбранных группах`;
  return groupCount === 1
    ? "В этой группе пока нет контактов"
    : "Нет контактов, которые входят во все выбранные группы";
}
