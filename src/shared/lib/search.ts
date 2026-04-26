export function normalizeSearchToken(value: string) {
  return value.trim().toLowerCase().replaceAll("ё", "е");
}

export function tokenizeSearchText(value: string) {
  return value
    .split(/\s+/u)
    .map(normalizeSearchToken)
    .filter(Boolean);
}

export function includesSearchTokens(value: string, query: string) {
  const haystack = normalizeSearchToken(value);
  const tokens = tokenizeSearchText(query);

  if (!tokens.length) {
    return true;
  }

  return tokens.every((token) => haystack.includes(token));
}
