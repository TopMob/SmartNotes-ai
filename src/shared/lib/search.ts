export function normalizeSearchToken(value: string) {
  return value.trim().toLowerCase().replaceAll("ё", "е");
}

export function tokenizeSearchText(value: string) {
  return value
    .split(/\s+/u)
    .map(normalizeSearchToken)
    .filter(Boolean);
}
