const RANGE = /\b([A-Z])(\d{4})\s*(?:-|–|\bto\b)\s*\1(\d{4})\b/i;

/**
 * The codes of a range clause (k.ledger Ledger): a clause holding the word `each` and a code range, two codes of one
 * letter joined by `-` or ` to ` with the first lower (`E2001-E2005`, `E2401 to E2406`), gives every code from the
 * first to the last, upper case. Any other clause gives `undefined`.
 */
export function rangeCodes(clause: string): string[] | undefined {
  const text = clause.replaceAll("`", "");
  const m = RANGE.exec(text);
  if (!/\beach\b/i.test(text) || m?.[1] === undefined || m[2] === undefined || m[3] === undefined) return undefined;
  const lo = Number(m[2]);
  const hi = Number(m[3]);
  if (hi <= lo) return undefined;
  const letter = m[1].toUpperCase();
  return Array.from({ length: hi - lo + 1 }, (_, i) => `${letter}${String(lo + i).padStart(4, "0")}`);
}
