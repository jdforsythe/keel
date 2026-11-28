/** The SQL calls whose answer a sim run does not replay (W2456). */
const CALLS =
  /\b(?:now\s*\(\s*\)|current_timestamp\b|clock_timestamp\s*\(\s*\)|random\s*\(\s*\)|gen_random_uuid\s*\(\s*\))/gi;

/** The offset of each call W2456 names in `text`, which starts at offset `base` of its file. */
export function callsIn(text: string, base: number): number[] {
  return [...text.matchAll(CALLS)].map((m) => base + m.index);
}
