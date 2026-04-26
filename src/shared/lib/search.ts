const ruToEnLayoutMap: Record<string, string> = {
  й: "q",
  ц: "w",
  у: "e",
  к: "r",
  е: "t",
  н: "y",
  г: "u",
  ш: "i",
  щ: "o",
  з: "p",
  х: "[",
  ъ: "]",
  ф: "a",
  ы: "s",
  в: "d",
  а: "f",
  п: "g",
  р: "h",
  о: "j",
  л: "k",
  д: "l",
  ж: ";",
  э: "'",
  я: "z",
  ч: "x",
  с: "c",
  м: "v",
  и: "b",
  т: "n",
  ь: "m",
  б: ",",
  ю: ".",
};

const enToRuLayoutMap = Object.fromEntries(
  Object.entries(ruToEnLayoutMap).map(([ru, en]) => [en, ru]),
) as Record<string, string>;

const translitMap: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ы: "y",
  э: "e",
  ю: "yu",
  я: "ya",
  ь: "",
  ъ: "",
};

export function normalizeSearchToken(value: string) {
  return value.trim().toLowerCase().replaceAll("ё", "е");
}

function remapKeyboardLayout(value: string, map: Record<string, string>) {
  return [...value].map((char) => map[char] ?? char).join("");
}

function transliterateRu(value: string) {
  return [...value].map((char) => translitMap[char] ?? char).join("");
}

function buildSearchVariants(value: string) {
  const normalized = normalizeSearchToken(value);

  return Array.from(
    new Set([
      normalized,
      remapKeyboardLayout(normalized, ruToEnLayoutMap),
      remapKeyboardLayout(normalized, enToRuLayoutMap),
      transliterateRu(normalized),
    ].filter(Boolean)),
  );
}

export function tokenizeSearchText(value: string) {
  return value
    .split(/\s+/u)
    .map(normalizeSearchToken)
    .filter(Boolean);
}

export function includesSearchTokens(value: string, query: string) {
  const haystackVariants = buildSearchVariants(value);
  const tokens = tokenizeSearchText(query);

  if (!tokens.length) {
    return true;
  }

  return tokens.every((token) => {
    const tokenVariants = buildSearchVariants(token);

    return tokenVariants.some((variant) => haystackVariants.some((haystack) => haystack.includes(variant)));
  });
}
