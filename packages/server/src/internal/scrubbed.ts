import { automatonOf } from "./automatonOf.ts";

const WORD = /[\p{L}\p{N}_]/u;

/** Whether the code point starting at `i` of `t` is a letter, digit or `_`. */
const word = (t: string, i: number): boolean =>
  i >= 0 && i < t.length && WORD.test(String.fromCodePoint(t.codePointAt(i) ?? 0));

/** Where the code point ending right before `at` starts: `at - 2` for a pair, else `at - 1`. */
const back = (t: string, at: number): number =>
  (t.charCodeAt(at - 1) & 0xfc00) === 0xdc00 && (t.charCodeAt(at - 2) & 0xfc00) === 0xd800 ? at - 2 : at - 1;

/** Whether `at` or `end` falls between the two halves of a surrogate pair of `t`. */
const split = (t: string, at: number, end: number): boolean =>
  [at, end].some((k) => (t.charCodeAt(k - 1) & 0xfc00) === 0xd800 && (t.charCodeAt(k) & 0xfc00) === 0xdc00);

/**
 * `message` with each value of each pass replaced by that pass's mark (k.privacy Server log), in each written form
 * `automatonOf` holds, case-folded, a form under 3 code units only as a whole token
 * that splits no surrogate pair. The text is read once: at each
 * code unit the automaton's longest valid match ending there joins the run of matches it overlaps, and each run is
 * replaced as a whole, so the whole of each marked copy is replaced. The run's mark is that of its longest match; of
 * two as long, the earlier pass's. Past the automaton's cap the message is one mark, the first pass's that holds a
 * value. `count`, for tests, adds the walk's steps and, when the automaton is built, the build's.
 */
export function scrubbed(
  message: string,
  passes: readonly (readonly [ReadonlySet<string>, string])[],
  count?: { build: number; walk: number; forms: number },
): string {
  const held = passes.find(([values]) => values.size > 0);
  if (held === undefined) return message;
  const a = automatonOf(
    passes.map(([values]) => values),
    count,
  );
  if (a === "over") return held[1];
  const { fold, go, fail, out, depth, term } = a;
  // Disjoint runs in order, four numbers each: start, end, length of the longest match, its pass.
  const runs: number[] = [];
  let s = 0;
  let steps = 0;
  for (let i = 0; i < message.length; i++) {
    const c = fold[message.charCodeAt(i)] ?? 0;
    for (;;) {
      steps++;
      const g = go(s, c);
      if (g >= 0) s = g;
      if (g >= 0 || s === 0) break;
      s = fail[s] ?? 0;
    }
    for (let t = out[s] ?? -1; t >= 0; t = out[fail[t] ?? 0] ?? -1) {
      steps++;
      let at = i + 1 - (depth[t] ?? 0);
      if (i + 1 - at < 3 && (word(message, back(message, at)) || word(message, i + 1) || split(message, at, i + 1)))
        continue;
      const tm = term[t] ?? 0;
      let end = i + 1;
      for (let p = tm & 3; p > 0 && message.charCodeAt(end) === 61; p--) end++;
      let long = end - at;
      let pass = (tm >> 2) - 1;
      while (at < (runs[runs.length - 3] ?? -1)) {
        const rp = runs.pop() ?? 0;
        const rl = runs.pop() ?? 0;
        end = Math.max(end, runs.pop() ?? 0);
        at = Math.min(at, runs.pop() ?? 0);
        if (rl > long || (rl === long && rp < pass)) {
          long = rl;
          pass = rp;
        }
      }
      runs.push(at, end, long, pass);
      break;
    }
  }
  if (count !== undefined) count.walk += steps;
  if (runs.length === 0) return message;
  const parts: string[] = [];
  let last = 0;
  for (let r = 0; r < runs.length; r += 4) {
    parts.push(message.slice(last, runs[r] ?? 0), passes[runs[r + 3] ?? 0]?.[1] ?? "");
    last = runs[r + 1] ?? 0;
  }
  parts.push(message.slice(last));
  return parts.join("");
}
