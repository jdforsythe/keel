import { heldMap } from "@keel/schema/internal";
import type { Automaton } from "./Automaton.ts";
import { foldTable } from "./foldTable.ts";
import { formsOf } from "./formsOf.ts";
import { pastCap } from "./pastCap.ts";

interface Count {
  build: number;
  walk: number;
}

const folded = (s: string, fold: Uint16Array): string => {
  let out = "";
  let from = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    const f = fold[c] ?? c;
    if (f !== c) {
      out += s.slice(from, i) + String.fromCharCode(f);
      from = i + 1;
    }
  }
  return from === 0 ? s : out + s.slice(from);
};

// One count per unit, reused by every build; each build sets back to 0 what it raised.
let tally: Int32Array | undefined;

/**
 * Sorts `xs[0..k)`, distinct 16-bit units, ascending: by insertion for 32 or fewer, else by two passes of a 256-bucket
 * radix sort. Returns the steps, at most 17 × k + 514.
 */
const sortUnits = (xs: Int32Array, k: number, tmp: Int32Array): number => {
  if (k <= 32) {
    let steps = 0;
    for (let a = 1; a < k; a++) {
      const x = xs[a] ?? 0;
      let b = a - 1;
      while (b >= 0 && (xs[b] ?? 0) > x) {
        xs[b + 1] = xs[b] ?? 0;
        b--;
        steps++;
      }
      xs[b + 1] = x;
      steps++;
    }
    return steps;
  }
  const buckets = new Int32Array(257);
  for (const shift of [0, 8]) {
    buckets.fill(0);
    for (let a = 0; a < k; a++) {
      const d = ((xs[a] ?? 0) >> shift) & 255;
      buckets[d + 1] = (buckets[d + 1] ?? 0) + 1;
    }
    for (let d = 1; d < 257; d++) buckets[d] = (buckets[d] ?? 0) + (buckets[d - 1] ?? 0);
    for (let a = 0; a < k; a++) {
      const d = ((xs[a] ?? 0) >> shift) & 255;
      const j = buckets[d] ?? 0;
      tmp[j] = xs[a] ?? 0;
      buckets[d] = j + 1;
    }
    for (let a = 0; a < k; a++) xs[a] = tmp[a] ?? 0;
  }
  return 4 * k + 2 * 257;
};

const build = (sets: readonly ReadonlySet<string>[], count: Count | undefined): Automaton => {
  const fold = foldTable();
  const texts: string[] = [];
  const meta: number[] = [];
  let m = 0;
  let steps = 0;
  sets.forEach((values, at) => {
    for (const v of values) {
      if (v === "") continue;
      for (const [form, before, after] of formsOf(v)) {
        const f = folded(form, fold);
        texts.push(f);
        // The set index, the count before and the count after, packed.
        meta.push(at * 4 + before * 2 + after);
        m += f.length;
        steps += f.length + 1;
      }
    }
  });
  const F = texts.length;
  const size = m + 1;
  const label = new Uint16Array(size);
  const parent = new Int32Array(size);
  const depth = new Int32Array(size);
  const kid = new Int32Array(size);
  const kids = new Int32Array(size);
  // Per node: -1 where no form ends, else the lowest set index of a form ending there, and the widening counts.
  const pass = new Int32Array(size).fill(-1);
  const before = new Uint8Array(size);
  const after = new Uint8Array(size);
  const lo = new Int32Array(size);
  const hi = new Int32Array(size);
  const idx = new Int32Array(F);
  const tmp = new Int32Array(F);
  for (let f = 0; f < F; f++) idx[f] = f;
  hi[0] = F;
  tally ??= new Int32Array(65_536);
  const cnt = tally;
  const touched = new Int32Array(Math.min(F, 65_536) + 1);
  const sortTmp = new Int32Array(Math.min(F, 65_536) + 1);
  let nodes = 1;
  // Nodes are made breadth-first, each node's children side by side in label order, so node order is queue order:
  // each node's forms, a slice of `idx`, are split by their next unit into its children's slices.
  for (let x = 0; x < nodes; x++) {
    const d = depth[x] ?? 0;
    const a = lo[x] ?? 0;
    const b = hi[x] ?? 0;
    let k = 0;
    let w = a;
    for (let j = a; j < b; j++) {
      const f = idx[j] ?? 0;
      const t = texts[f] ?? "";
      steps++;
      if (t.length === d) {
        const mt = meta[f] ?? 0;
        const p = mt >> 2;
        const had = pass[x] ?? -1;
        pass[x] = had < 0 ? p : Math.min(had, p);
        before[x] = Math.max(before[x] ?? 0, (mt >> 1) & 1);
        after[x] = Math.max(after[x] ?? 0, mt & 1);
        continue;
      }
      const c = t.charCodeAt(d);
      if ((cnt[c] ?? 0) === 0) touched[k++] = c;
      cnt[c] = (cnt[c] ?? 0) + 1;
      w++;
    }
    kid[x] = nodes;
    kids[x] = k;
    if (k === 0) continue;
    steps += sortUnits(touched, k, sortTmp);
    let off = a;
    for (let j = 0; j < k; j++) {
      const c = touched[j] ?? 0;
      const y = nodes++;
      label[y] = c;
      parent[y] = x;
      depth[y] = d + 1;
      lo[y] = off;
      off += cnt[c] ?? 0;
      hi[y] = off;
      cnt[c] = lo[y] ?? 0;
    }
    for (let j = a; j < b; j++) {
      const f = idx[j] ?? 0;
      const t = texts[f] ?? "";
      if (t.length === d) continue;
      const c = t.charCodeAt(d);
      const at = cnt[c] ?? 0;
      tmp[at] = f;
      cnt[c] = at + 1;
    }
    for (let j = a; j < w; j++) idx[j] = tmp[j] ?? 0;
    for (let j = 0; j < k; j++) cnt[touched[j] ?? 0] = 0;
    steps += b - a + k;
  }
  const go = (s: number, c: number): number => {
    let l = kid[s] ?? 0;
    let h = l + (kids[s] ?? 0) - 1;
    while (l <= h) {
      const mid = (l + h) >> 1;
      const x = label[mid] ?? 0;
      if (x === c) return mid;
      if (x < c) l = mid + 1;
      else h = mid - 1;
    }
    return -1;
  };
  // Failure links in node order, which is breadth-first; `long` and `short` are the deepest node on a node's failure
  // chain, itself included, where a form of 3 or more units, or of fewer, ends. A long form takes in the lowest set
  // index and the widening after of every long form that ends inside it at the same unit, so a match reads one node.
  const fail = new Int32Array(nodes);
  const long = new Int32Array(nodes).fill(-1);
  const short = new Int32Array(nodes).fill(-1);
  for (let x = 1; x < nodes; x++) {
    const p = parent[x] ?? 0;
    const c = label[x] ?? 0;
    let f = 0;
    if (p !== 0) {
      for (let g = fail[p] ?? 0; ; g = fail[g] ?? 0) {
        steps++;
        const h = go(g, c);
        if (h >= 0) {
          f = h;
          break;
        }
        if (g === 0) break;
      }
    }
    fail[x] = f;
    const ends = (pass[x] ?? -1) >= 0;
    const lf = long[f] ?? -1;
    if (ends && (depth[x] ?? 0) >= 3) {
      long[x] = x;
      if (lf >= 0) {
        pass[x] = Math.min(pass[x] ?? 0, pass[lf] ?? 0);
        after[x] = Math.max(after[x] ?? 0, after[lf] ?? 0);
      }
    } else long[x] = lf;
    short[x] = ends && (depth[x] ?? 0) < 3 ? x : (short[f] ?? -1);
  }
  if (count !== undefined) count.build += steps;
  return { fold, go, fail, long, short, depth, pass, before, after };
};

const cache = heldMap<
  ReadonlySet<string>,
  { readonly sets: readonly ReadonlySet<string>[]; readonly sizes: readonly number[]; readonly built: Automaton }
>();

/**
 * The matcher of every form (`formsOf`) of every value of `sets`, folded (`foldTable`), or `"over"` when any of `sets`
 * is past the scrub's cap (`pastCap`), read before the cache and before building. A request's sets only grow, so the
 * matcher is kept per first set and built again only when one of them has grown. It is a trie of the forms with
 * Aho-Corasick failure links, built with no sort of the forms or hash table: breadth-first, each node's forms split by
 * their next unit through one count per unit, so the build takes steps linear in the forms' units (about 11 form
 * units per ASCII byte of the values, and up to 50 steps per byte). `count`, for tests, adds the build's steps.
 */
export function automatonOf(sets: readonly ReadonlySet<string>[], count?: Count): Automaton | "over" {
  if (sets.some((set) => pastCap.has(set))) return "over";
  const key = sets[0];
  const had = key === undefined ? undefined : cache.get(key);
  if (
    had !== undefined &&
    had.sets.length === sets.length &&
    sets.every((set, i) => set === had.sets[i] && set.size === had.sizes[i])
  )
    return had.built;
  const built = build(sets, count);
  if (key !== undefined) cache.set(key, { sets, sizes: sets.map((set) => set.size), built });
  return built;
}
