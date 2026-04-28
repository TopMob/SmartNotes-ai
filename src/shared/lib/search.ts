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

const synonyms: Record<string, string[]> = {
  todo: ["task", "задача", "дело"],
  task: ["todo", "задача", "дело"],
  задача: ["task", "todo", "дело"],
  идея: ["idea", "мысль"],
  idea: ["идея", "thought"],
  meeting: ["встреча", "созвон"],
  встреча: ["meeting", "созвон"],
  password: ["пароль", "login"],
  пароль: ["password", "логин"],
  archive: ["архив"],
  архив: ["archive"],
};

export function normalizeSearchToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}\s_-]+/gu, "");
}

function remapKeyboardLayout(value: string, map: Record<string, string>) {
  return [...value].map((char) => map[char] ?? char).join("");
}

function transliterateRu(value: string) {
  return [...value].map((char) => translitMap[char] ?? char).join("");
}

function stemToken(value: string) {
  if (/^[а-я]+$/u.test(value)) {
    return value.replace(/(иями|ями|ами|ого|ему|ыми|ими|ая|яя|ое|ее|ые|ие|ый|ий|ой|ам|ям|ах|ях|ов|ев|ом|ем|а|я|ы|и|у|ю|е|о)$/u, "");
  }

  return value.replace(/(ing|edly|edly|ed|ies|es|s)$/u, (suffix) => (suffix === "ies" ? "y" : ""));
}

function simplifyEnglishPhonetics(value: string) {
  return value
    .replace(/ph/gu, "f")
    .replace(/ck/gu, "k")
    .replace(/q/gu, "k")
    .replace(/x/gu, "ks")
    .replace(/[aeiou]{2,}/gu, (match) => match[0] ?? match);
}

function levenshteinDistance(left: string, right: string) {
  if (left === right) {
    return 0;
  }

  if (!left.length) {
    return right.length;
  }

  if (!right.length) {
    return left.length;
  }

  let previous = Array.from({ length: right.length + 1 }, (_value, index) => index);

  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const current = [leftIndex + 1];

    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      current[rightIndex + 1] = Math.min(
        current[rightIndex] + 1,
        previous[rightIndex + 1] + 1,
        previous[rightIndex] + (left[leftIndex] === right[rightIndex] ? 0 : 1),
      );
    }

    previous = current;
  }

  return previous[right.length] ?? Math.max(left.length, right.length);
}

function buildSearchVariants(value: string) {
  const normalized = normalizeSearchToken(value);

  return Array.from(
    new Set([
      normalized,
      remapKeyboardLayout(normalized, ruToEnLayoutMap),
      remapKeyboardLayout(normalized, enToRuLayoutMap),
      transliterateRu(normalized),
      stemToken(normalized),
      simplifyEnglishPhonetics(normalized),
      ...tokenizeSearchText(synonyms[normalized]?.join(" ") ?? ""),
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

export function scoreSearchMatch(fields: Array<{ value: string; weight: number }>, query: string) {
  const tokens = tokenizeSearchText(query);

  if (!tokens.length) {
    return 1;
  }

  let score = 0;

  for (const token of tokens) {
    const tokenVariants = buildSearchVariants(token);
    let bestTokenScore = 0;

    for (const field of fields) {
      const fieldTokens = tokenizeSearchText(field.value);
      const fieldVariants = buildSearchVariants(field.value);
      const exactMatch = tokenVariants.some((variant) => fieldVariants.some((haystack) => haystack.includes(variant)));

      if (exactMatch) {
        bestTokenScore = Math.max(bestTokenScore, field.weight);
        continue;
      }

      const fuzzyMatch = fieldTokens.some((fieldToken) =>
        tokenVariants.some((variant) => {
          const maxDistance = variant.length > 6 ? 2 : 1;

          return Math.min(variant.length, fieldToken.length) >= 4 && levenshteinDistance(variant, fieldToken) <= maxDistance;
        }),
      );

      if (fuzzyMatch) {
        bestTokenScore = Math.max(bestTokenScore, field.weight * 0.6);
      }
    }

    if (bestTokenScore === 0) {
      return 0;
    }

    score += bestTokenScore;
  }

  return score;
}
