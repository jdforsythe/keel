import { folded } from "./folded.ts";

/** Below this length a value is replaced only where it stands as a whole token. */
const SHORT = 3;
/** The longest form an expression holds; a longer one is found by a linear scan (`scrubbed`). */
const LONG = 1_000;
/** The most pattern text one expression holds, well under what the engine compiles. */
const BATCH = 16_000;
const UNPAIRED = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const EDGE = /^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/;
const literal = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const base64 = (s: string): string =>
  btoa(Array.from(new TextEncoder().encode(s), (b) => String.fromCharCode(b)).join(""));

/**
 * The written forms of `v`: as is, `encodeURIComponent` (none for an ill-formed value, one with a lone surrogate),
 * `JSON.stringify` escaping, base64 with and without its padding, and base64url without it.
 */
const formsOf = (v: string): string[] => {
  const padded = base64(v);
  const b = padded.replace(/=+$/, "");
  const forms = [v, JSON.stringify(v).slice(1, -1), padded, b, b.replace(/\+/g, "-").replace(/\//g, "_")];
  return UNPAIRED.test(v) ? forms : [...forms, encodeURIComponent(v)];
};

/** The KMP failure table of `p`: at each index, the length of the longest proper prefix that also ends there. */
const table = (p: string): Int32Array => {
  const fail = new Int32Array(p.length);
  for (let i = 1, k = 0; i < p.length; i++) {
    while (k > 0 && p.charCodeAt(i) !== p.charCodeAt(k)) k = fail[k - 1] ?? 0;
    if (p.charCodeAt(i) === p.charCodeAt(k)) k++;
    fail[i] = k;
  }
  return fail;
};

/** A short form stands only as a whole token: no letter, digit or `_` right before or after it. */
const BEFORE = "(?<![\\p{L}\\p{N}_])(?:";
const AFTER = ")(?![\\p{L}\\p{N}_])";

const batched = (alts: readonly string[], flags: string, into: RegExp[], whole: boolean): void => {
  const close = (batch: readonly string[]): void => {
    const body = whole ? `${BEFORE}${batch.join("|")}${AFTER}` : batch.join("|");
    into.push(new RegExp(body, `g${flags}`));
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

/** What a set is matched with: expressions for forms up to 1,000 code units, folded forms with tables for longer. */
type Matcher = {
  readonly batches: readonly RegExp[];
  readonly long: readonly { readonly form: string; readonly fail: Int32Array }[];
};

const build = (values: ReadonlySet<string>): Matcher => {
  const forms = new Set<string>();
  for (const v of values) for (const f of formsOf(v)) if (f !== "") forms.add(f);
  const sorted = [...forms].sort((a, b) => b.length - a.length);
  const batches: RegExp[] = [];
  const long = new Map<string, Int32Array>();
  const short: string[] = [];
  const code: string[] = [];
  const units: string[] = [];
  for (const f of sorted) {
    if (f.length > LONG) {
      const form = folded(f);
      if (!long.has(form)) long.set(form, table(form));
      continue;
    }
    (f.length < SHORT ? short : code).push(literal(f));
    // A form that starts with a low surrogate or ends with a high one can sit in the text as half of a pair, which a
    // code point match never sees: it is matched by code unit too.
    if (f.length >= SHORT && EDGE.test(f)) units.push(literal(f));
  }
  batched(short, "iu", batches, true);
  batched(code, "iu", batches, false);
  batched(units, "i", batches, false);
  return { batches, long: [...long].map(([form, fail]) => ({ form, fail })) };
};

const built = new WeakMap<ReadonlySet<string>, { readonly seen: ReadonlySet<string>; readonly matcher: Matcher }>();

/**
 * The matchers of each written form of `values` (k.privacy Server log, `formsOf`), case-insensitive, a form under 3
 * characters only as a whole token. Forms up to 1,000 code units are batched into expressions of at most 16,000
 * pattern characters, so no value makes an expression the engine refuses; a longer form is kept case-folded
 * (`folded`) with its KMP table, for a scan linear in the text and the form. The matchers are kept for `values` and
 * built again only when it holds a value they were not built from.
 */
export function matcherOf(values: ReadonlySet<string>): Matcher {
  const had = built.get(values);
  if (had !== undefined && had.seen.size === values.size) {
    let same = true;
    for (const v of values) if (!had.seen.has(v)) same = false;
    if (same) return had.matcher;
  }
  const matcher = build(values);
  built.set(values, { seen: new Set(values), matcher });
  return matcher;
}
