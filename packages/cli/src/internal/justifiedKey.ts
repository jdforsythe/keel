const flat = (s: string): string => s.replace(/\s+/g, " ").trim();

/**
 * The identity of a justified entry and of a mutant (k.ledger Justified survivors): file, mutator, original and
 * replacement, runs of white space in the two texts counting as one space.
 */
export function justifiedKey(e: {
  readonly file: string;
  readonly mutator: string;
  readonly original: string;
  readonly replacement: string;
}): string {
  return [e.file, e.mutator, flat(e.original), flat(e.replacement)].join("\0");
}
