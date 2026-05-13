// Search Engine utility functions

const EN_TO_RU: Record<string, string> = {
  q: 'й', w: 'ц', e: 'у', r: 'к', t: 'е', y: 'н', u: 'г', i: 'ш', o: 'щ', p: 'з', '[': 'х', ']': 'ъ',
  a: 'ф', s: 'ы', d: 'в', f: 'а', g: 'п', h: 'р', j: 'о', k: 'л', l: 'д', ';': 'ж', "'": 'э',
  z: 'я', x: 'ч', c: 'с', v: 'м', b: 'и', n: 'т', m: 'ь', ',': 'б', '.': 'ю', '`': 'ё'
};

const RU_TO_EN: Record<string, string> = Object.entries(EN_TO_RU).reduce((acc, [en, ru]) => {
  acc[ru] = en;
  return acc;
}, {} as Record<string, string>);

export function normalizeText(text: string): string {
  if (!text) return "";
  return text.toLowerCase().replace(/ё/g, "е").trim();
}

export function fixLayout(text: string): string[] {
  if (!text) return [];
  const normalized = normalizeText(text);

  // Try mapping EN to RU
  let enToRu = "";
  let ruToEn = "";

  for (const char of normalized) {
    enToRu += EN_TO_RU[char] || char;
    ruToEn += RU_TO_EN[char] || char;
  }

  const variants = [normalized];
  if (enToRu !== normalized) variants.push(enToRu);
  if (ruToEn !== normalized) variants.push(ruToEn);

  return variants;
}

export function calculateScore(item: { title: string; content: string; userTags?: string[]; hiddenTags?: string[] }, query: string): number {
  if (!query) return 1;

  const variants = fixLayout(query);
  const title = normalizeText(item.title);
  const content = normalizeText(item.content);
  const userTags = (item.userTags || []).map(normalizeText);
  const hiddenTags = (item.hiddenTags || []).map(normalizeText);

  let maxScore = 0;

  for (const q of variants) {
    let score = 0;

    // Exact match weight
    if (title === q) score += 100;
    else if (title.includes(q)) score += 50;

    if (userTags.includes(q)) score += 80;
    if (hiddenTags.includes(q)) score += 60;

    if (content === q) score += 40;
    else if (content.includes(q)) score += 20;

    // Fuzzy/Partial match weight (primitive)
    const tokens = q.split(/\s+/);
    for (const token of tokens) {
      if (token.length < 3) continue;
      if (title.includes(token)) score += 10;
      if (content.includes(token)) score += 5;
      if (userTags.some(t => t.includes(token))) score += 15;
    }

    maxScore = Math.max(maxScore, score);
  }

  return maxScore;
}
