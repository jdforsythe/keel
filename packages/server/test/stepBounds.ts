import { foldTable } from "../src/internal/foldTable.ts";
import { formsOf } from "../src/internal/formsOf.ts";
import { readingsOf } from "../src/internal/readingsOf.ts";

/** The most steps the matcher's sort of `k` distinct child units takes: insertion for 32 or fewer, else two radix passes. */
const sortMost = (k: number): number => (k < 2 ? 0 : k <= 32 ? k - 1 + (k * (k - 1)) / 2 : 4 * k + 2 * 257);

const folded = (s: string, fold: Uint16Array): string => {
  let out = "";
  for (let i = 0; i < s.length; i++) out += String.fromCharCode(fold[s.charCodeAt(i)] ?? 0);
  return out;
};

/**
 * The most steps the scrub may count for `message` scrubbed with `sets` (test helper), derived from the parts of its
 * work and not from a run. The walk: per unit of each reading (`readingsOf`), one step to advance, at most one per
 * failure link followed (each lowers the depth that advancing raised by one), one for a form of 3 or more units ending
 * and two for forms of 1 or 2: 5 per unit. The build, over `units` (the forms' units) and `forms` (the forms, of each
 * non-empty value of each set, `formsOf`): forming them (units + 1 each), visiting each at every node of its path
 * (units + 1 each again), splitting each branching node's forms among its children (at most units + 1 each, plus one
 * per child), sorting each branching node's child units (`sortMost`), and failure links (one per node below the root
 * plus at most one hop per form unit). The trie of the folded forms is made here on its own to count its `nodes` and
 * each node's children.
 */
export function stepBounds(
  message: string,
  sets: readonly ReadonlySet<string>[],
): { walk: number; build: number; nodes: number; units: number; forms: number; readings: number[] } {
  const fold = foldTable();
  const texts: string[] = [];
  let units = 0;
  for (const set of sets)
    for (const v of set) {
      if (v === "") continue;
      for (const [f] of formsOf(v)) {
        texts.push(folded(f, fold));
        units += f.length;
      }
    }
  const forms = texts.length;
  texts.sort();
  // Children counted per node along the path of the last form read, the root first.
  const kids = [0];
  let nodes = 1;
  let sorts = 0;
  let prev = "";
  for (const t of texts) {
    if (t === prev) continue;
    let l = 0;
    while (l < prev.length && l < t.length && prev.charCodeAt(l) === t.charCodeAt(l)) l++;
    while (kids.length - 1 > l) sorts += sortMost(kids.pop() ?? 0);
    kids[l] = (kids[l] ?? 0) + 1;
    kids.push(0);
    for (let d = l + 2; d <= t.length; d++) {
      kids[d - 1] = (kids[d - 1] ?? 0) + 1;
      kids.push(0);
    }
    nodes += t.length - l;
    prev = t;
  }
  while (kids.length > 0) sorts += sortMost(kids.pop() ?? 0);
  const readings = readingsOf(message).map((v) => v.n);
  return {
    walk: 5 * readings.reduce((n, r) => n + r, 0),
    build: 4 * units + 3 * forms + 2 * (nodes - 1) + sorts,
    nodes,
    units,
    forms,
    readings,
  };
}
