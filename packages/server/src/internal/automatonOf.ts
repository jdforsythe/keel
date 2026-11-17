/** Past this many characters of distinct folded forms no automaton is built, and each text is one mark. */
const CAP = 2_000_000;
const UTF8 = new TextEncoder();
const UNPAIRED = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

/** The matcher of every written form of every set: an Aho-Corasick automaton over the folded forms, in typed arrays. */
interface Automaton {
  /** Each code unit's image under case folding; text and forms go through the same table. */
  readonly fold: Uint16Array;
  /** The state reached from `s` on the folded unit `c`, or -1. */
  readonly go: (s: number, c: number) => number;
  readonly fail: Int32Array;
  /** The deepest state on `s`'s failure chain, `s` included, that ends a form, or -1. */
  readonly out: Int32Array;
  readonly depth: Int32Array;
  /** 0 where no form ends; else (the lowest set index holding the form + 1) × 4 + the form's padding count. */
  readonly term: Uint16Array;
}

interface Count {
  build: number;
  walk: number;
  forms: number;
}

let table: Uint16Array | undefined;

/**
 * Letter case in the Basic Multilingual Plane, one code unit at a time: a unit maps to its upper-then-lower case when
 * that is one unit, else to its lower case when that is one unit, else to itself. A surrogate maps to itself.
 */
const foldTable = (): Uint16Array => {
  if (table !== undefined) return table;
  const t = new Uint16Array(65_536);
  for (let u = 0; u < 65_536; u++) {
    const c = String.fromCharCode(u);
    const x = c.toUpperCase().toLowerCase();
    const y = c.toLowerCase();
    t[u] = x.length === 1 ? x.charCodeAt(0) : y.length === 1 ? y.charCodeAt(0) : u;
  }
  table = t;
  return t;
};

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

/**
 * Adds the written forms of `v` to `into`, folded, each to its lowest set index and padding count: as is,
 * `JSON.stringify` escaping, `encodeURIComponent` (none for a value with a lone surrogate), and base64 of its UTF-8
 * bytes. Under 8 bytes that is the padded form only; from 8 bytes (11 or more characters, too long to stand in ordinary
 * text by chance) the unpadded standard and base64url forms, which take in the padding that follows them.
 */
const formsInto = (v: string, at: number, into: Map<string, number>, fold: Uint16Array): void => {
  const bytes = UTF8.encode(v);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const padded = btoa(binary);
  const forms: [string, number][] = [
    [v, 0],
    [JSON.stringify(v).slice(1, -1), 0],
  ];
  if (!UNPAIRED.test(v)) forms.push([encodeURIComponent(v), 0]);
  if (bytes.length < 8) forms.push([padded, 0]);
  else {
    const pad = (3 - (bytes.length % 3)) % 3;
    const b = padded.slice(0, padded.length - pad);
    forms.push([b, pad], [b.replace(/\+/g, "-").replace(/\//g, "_"), pad]);
  }
  for (const [form, pad] of forms) {
    if (form === "") continue;
    const f = folded(form, fold);
    const had = into.get(f);
    into.set(f, had === undefined ? at * 4 + pad : Math.min(had >> 2, at) * 4 + Math.max(had & 3, pad));
  }
};

const build = (sets: readonly ReadonlySet<string>[], count: Count | undefined): Automaton | "over" => {
  const fold = foldTable();
  const forms = new Map<string, number>();
  sets.forEach((values, at) => {
    for (const v of values) formsInto(v, at, forms, fold);
  });
  let m = 0;
  for (const f of forms.keys()) m += f.length;
  if (count !== undefined) count.forms += m;
  if (m > CAP) return "over";
  // The trie in preorder: the sorted forms, each sharing its common prefix with the one before.
  const label = new Uint16Array(m + 1);
  const parent = new Int32Array(m + 1);
  const depth = new Int32Array(m + 1);
  const term = new Uint16Array(m + 1);
  const path = [0];
  let nodes = 1;
  let prev = "";
  let steps = 0;
  for (const f of [...forms.keys()].sort()) {
    let l = 0;
    const lim = Math.min(prev.length, f.length);
    while (l < lim && prev.charCodeAt(l) === f.charCodeAt(l)) l++;
    steps += l + 1;
    path.length = l + 1;
    for (let d = l; d < f.length; d++, steps++) {
      label[nodes] = f.charCodeAt(d);
      parent[nodes] = path[d] ?? 0;
      depth[nodes] = d + 1;
      path.push(nodes++);
    }
    term[path[f.length] ?? 0] = (forms.get(f) ?? 0) + 4;
    prev = f;
  }
  // Each node's children side by side in label order: `kids[start[s]]` to `kids[start[s + 1] - 1]`.
  const start = new Int32Array(nodes + 1);
  const kids = new Int32Array(nodes);
  for (let x = 1; x < nodes; x++) {
    const p = (parent[x] ?? 0) + 1;
    start[p] = (start[p] ?? 0) + 1;
  }
  for (let s = 1; s <= nodes; s++) start[s] = (start[s] ?? 0) + (start[s - 1] ?? 0);
  const fill = start.slice(0, nodes);
  for (let x = 1; x < nodes; x++) {
    const p = parent[x] ?? 0;
    const j = fill[p] ?? 0;
    kids[j] = x;
    fill[p] = j + 1;
  }
  const go = (s: number, c: number): number => {
    let lo = start[s] ?? 0;
    let hi = (start[s + 1] ?? 0) - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const k = kids[mid] ?? 0;
      const x = label[k] ?? 0;
      if (x === c) return k;
      if (x < c) lo = mid + 1;
      else hi = mid - 1;
    }
    return -1;
  };
  // Failure links breadth-first.
  const fail = new Int32Array(nodes);
  const out = new Int32Array(nodes);
  out[0] = -1;
  const queue = new Int32Array(nodes);
  let tail = 1;
  for (let head = 0; head < tail; head++) {
    const x = queue[head] ?? 0;
    const p = parent[x] ?? 0;
    if (x !== 0) {
      let f = 0;
      for (let g = fail[p] ?? 0; p !== 0; g = fail[g] ?? 0) {
        steps++;
        const h = go(g, label[x] ?? 0);
        if (h >= 0) f = h;
        if (h >= 0 || g === 0) break;
      }
      fail[x] = f;
      out[x] = term[x] !== 0 ? x : (out[f] ?? -1);
    }
    for (let j = start[x] ?? 0; j < (start[x + 1] ?? 0); j++) queue[tail++] = kids[j] ?? 0;
  }
  if (count !== undefined) count.build += steps;
  return { fold, go, fail, out, depth, term };
};

const holds = (seen: ReadonlySet<string> | undefined, set: ReadonlySet<string>): boolean => {
  if (seen === undefined || seen.size !== set.size) return false;
  for (const v of set) if (!seen.has(v)) return false;
  return true;
};

const cache = new WeakMap<
  ReadonlySet<string>,
  {
    readonly sets: readonly ReadonlySet<string>[];
    readonly seen: readonly ReadonlySet<string>[];
    readonly built: Automaton | "over";
  }
>();

/**
 * The automaton over every written form of the values of `sets` (`formsInto`), folded (`foldTable`), or `"over"` when
 * those forms, each counted once, pass 2,000,000 characters. It is kept for the sets and built again only when one of
 * them holds a value it was not built from. `count`, for tests, adds the build's steps and the forms' characters.
 */
export function automatonOf(sets: readonly ReadonlySet<string>[], count?: Count): Automaton | "over" {
  const key = sets[0];
  const had = key === undefined ? undefined : cache.get(key);
  if (
    had !== undefined &&
    had.sets.length === sets.length &&
    sets.every((set, i) => set === had.sets[i] && holds(had.seen[i], set))
  )
    return had.built;
  const built = build(sets, count);
  if (key !== undefined) cache.set(key, { sets, seen: sets.map((set) => new Set(set)), built });
  return built;
}
