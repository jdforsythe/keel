import type { Probe } from "./Probe.ts";

/** Below this length a value is replaced only where it stands as a whole token. */
const SHORT = 3;
/** The longest piece of a value one expression holds; a longer value is matched piece by piece. */
const PIECE = 1_000;
/** The most pattern text one expression holds, well under what the engine compiles. */
const BATCH = 16_000;
const UNPAIRED = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const EDGE = /^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/;
const high = (c: number): boolean => c >= 0xd800 && c <= 0xdbff;
const literal = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const base64 = (s: string): string =>
  btoa(Array.from(new TextEncoder().encode(s), (b) => String.fromCharCode(b)).join(""));

/** The written forms of `v`; an ill-formed value (a lone surrogate) has no `encodeURIComponent` form. */
const formsOf = (v: string): string[] => {
  const json = JSON.stringify(v).slice(1, -1);
  return UNPAIRED.test(v) ? [v, json, base64(v)] : [v, encodeURIComponent(v), json, base64(v)];
};

/** `f` cut into pieces of at most `PIECE` code units, never inside a surrogate pair. */
const pieces = (f: string): string[] => {
  const out: string[] = [];
  for (let at = 0; at < f.length; ) {
    let end = Math.min(at + PIECE, f.length);
    if (end < f.length && high(f.charCodeAt(end - 1))) end--;
    out.push(f.slice(at, end));
    at = end;
  }
  return out;
};

const chained = (f: string, flags: string): Probe => {
  const [first = "", ...rest] = pieces(f).map(literal);
  return { head: new RegExp(first, `g${flags}`), tail: rest.map((p) => new RegExp(p, `y${flags}`)) };
};

/** A short form stands only as a whole token: no letter, digit or `_` right before or after it. */
const BEFORE = "(?<![\\p{L}\\p{N}_])(?:";
const AFTER = ")(?![\\p{L}\\p{N}_])";

const batched = (alts: readonly string[], flags: string, into: Probe[], whole: boolean): void => {
  const close = (batch: readonly string[]): void => {
    const body = whole ? `${BEFORE}${batch.join("|")}${AFTER}` : batch.join("|");
    into.push({ head: new RegExp(body, `g${flags}`), tail: [] });
  };
  let batch: string[] = [];
  let size = 0;
  for (const a of alts) {
    if (size + a.length + 1 > BATCH && batch.length > 0) {
      close(batch);
      batch = [];
      size = 0;
    }
    batch.push(a);
    size += a.length + 1;
  }
  if (batch.length > 0) close(batch);
};

const build = (values: ReadonlySet<string>): Probe[] => {
  const forms = new Set<string>();
  for (const v of values) for (const f of formsOf(v)) if (f !== "") forms.add(f);
  const sorted = [...forms].sort((a, b) => b.length - a.length);
  const probes: Probe[] = [];
  const short: string[] = [];
  const code: string[] = [];
  const units: string[] = [];
  for (const f of sorted) {
    // A form that starts with a low surrogate or ends with a high one can sit in the text as half of a pair, which a
    // code point match never sees: it is matched by code unit too.
    const edge = f.length >= SHORT && EDGE.test(f);
    if (f.length > PIECE) {
      probes.push(chained(f, "iu"));
      if (edge) probes.push(chained(f, "i"));
      continue;
    }
    (f.length < SHORT ? short : code).push(literal(f));
    if (edge) units.push(literal(f));
  }
  batched(short, "iu", probes, true);
  batched(code, "iu", probes, false);
  batched(units, "i", probes, false);
  return probes;
};

const built = new WeakMap<ReadonlySet<string>, { readonly seen: ReadonlySet<string>; readonly probes: Probe[] }>();

/**
 * The matchers of each written form of `values` (k.privacy Server log): as is, its `encodeURIComponent` form, its
 * `JSON.stringify` escaping and its whole-value UTF-8 base64, case-insensitive, a form under 3 characters only as a
 * whole token. Forms are batched into expressions of at most 16,000 pattern characters, and a form over 1,000 code
 * units is matched in pieces, so no value makes an expression the engine refuses. The matchers are kept for `values`
 * and built again only when it holds a value they were not built from.
 */
export function matcherOf(values: ReadonlySet<string>): readonly Probe[] {
  const had = built.get(values);
  if (had !== undefined && had.seen.size === values.size) {
    let same = true;
    for (const v of values) if (!had.seen.has(v)) same = false;
    if (same) return had.probes;
  }
  const probes = build(values);
  built.set(values, { seen: new Set(values), probes });
  return probes;
}
