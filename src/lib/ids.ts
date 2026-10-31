const MAX_INTEGER_ID = 2_147_483_647;

// Accepts an id from a URL segment or a bound action argument; null if it is not a valid id
export function parseContactId(value: unknown): number | null {
  const text = String(value);
  if (!/^\d{1,10}$/.test(text)) return null;
  const id = Number(text);
  return id >= 1 && id <= MAX_INTEGER_ID ? id : null;
}

// Reads the repeated `group` URL parameter: valid ids only, without repeats, in the given order
export function parseGroupIds(value: string | string[] | undefined): number[] {
  const values = value === undefined ? [] : Array.isArray(value) ? value : [value];
  const ids = values.map(parseContactId).filter((id): id is number => id !== null);
  return [...new Set(ids)];
}
