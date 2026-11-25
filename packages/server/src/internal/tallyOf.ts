const tallies = new WeakMap<
  ReadonlySet<string>,
  { bytes: number; readonly counted: Set<string>; readonly sets: ReadonlySet<string>[] }
>();

/**
 * The byte count shared by the value sets of one scope (k.privacy Cost): the UTF-8 bytes of each distinct string
 * counted so far (`counted`) and the sets that share it (`sets`). A set has its own count until `joining` names a set
 * whose count it then shares, so a request's secret and `.pii()` sets count together; `createApp` joins them before
 * either holds a value.
 */
export function tallyOf(
  set: ReadonlySet<string>,
  joining?: ReadonlySet<string>,
): { bytes: number; readonly counted: Set<string>; readonly sets: ReadonlySet<string>[] } {
  const had = tallies.get(set);
  if (joining === undefined && had !== undefined) return had;
  const t = joining === undefined ? { bytes: 0, counted: new Set<string>(), sets: [] } : tallyOf(joining);
  if (!t.sets.includes(set)) t.sets.push(set);
  tallies.set(set, t);
  return t;
}
