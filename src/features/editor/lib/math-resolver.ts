export function resolveSimpleMathExpression(expression: string) {
  if (!/^[\d+\-*/().\s]+$/u.test(expression)) {
    return null;
  }

  try {
    const result = Function(`"use strict"; return (${expression});`)() as unknown;
    return typeof result === "number" && Number.isFinite(result) ? String(result) : null;
  } catch {
    return null;
  }
}
