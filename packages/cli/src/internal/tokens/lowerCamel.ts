/**
 * The words of `parts` (each split at anything but a letter or a digit) joined in lowerCamel: the first word's first
 * letter lowercase, each further word's uppercase, the rest of each word as written. Digits are unchanged.
 */
export function lowerCamel(parts: readonly string[]): string {
  const words = parts.flatMap((p) => p.split(/[^A-Za-z0-9]+/)).filter((w) => w !== "");
  return words.map((w, i) => (i === 0 ? w.charAt(0).toLowerCase() : w.charAt(0).toUpperCase()) + w.slice(1)).join("");
}
