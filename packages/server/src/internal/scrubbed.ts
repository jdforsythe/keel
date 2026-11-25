import { TEXT_CAP } from "./TEXT_CAP.ts";
import type { View } from "./View.ts";
import { automatonOf } from "./automatonOf.ts";
import { readingsOf } from "./readingsOf.ts";
import { slotLost } from "./slotLost.ts";

const WORD = /[\p{L}\p{N}\p{M}_]/u;

/** The code point of `v` starting at `i`, or -1 outside it. */
const pointAt = (v: View, i: number): number => {
  if (i < 0 || i >= v.n) return -1;
  const c = v.units[i] ?? 0;
  const d = v.units[i + 1] ?? 0;
  return (c & 0xfc00) === 0xd800 && i + 1 < v.n && (d & 0xfc00) === 0xdc00
    ? 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00)
    : c;
};
/** Whether the code point starting at `i` of `v` is a letter, digit, combining mark or `_`. */
const word = (v: View, i: number): boolean => {
  const p = pointAt(v, i);
  return p >= 0 && WORD.test(String.fromCodePoint(p));
};
/** Where the code point ending right before `at` starts: `at - 2` for a pair, else `at - 1`. */
const back = (v: View, at: number): number =>
  at >= 2 && ((v.units[at - 1] ?? 0) & 0xfc00) === 0xdc00 && ((v.units[at - 2] ?? 0) & 0xfc00) === 0xd800
    ? at - 2
    : at - 1;
/** Whether `k` falls between the two halves of a surrogate pair of `v`. */
const splits = (v: View, k: number): boolean =>
  k > 0 && k < v.n && ((v.units[k - 1] ?? 0) & 0xfc00) === 0xd800 && ((v.units[k] ?? 0) & 0xfc00) === 0xdc00;

/**
 * `message` with each copy of a value of each pass replaced by that pass's mark (k.privacy Copies, Views, Base64).
 * Each reading of the message (`readingsOf`: as is and up to five decoded views) is walked once with the matcher of
 * every form of every pass's values (`automatonOf`), folded. At each unit the deepest form of 3 or more units ending
 * there is a copy, widened by the characters and `=` its form takes in; so is each form of 1 or 2 units ending there
 * that stands as a whole token (no letter, digit, mark or `_` beside it in that reading) and splits no surrogate pair.
 * A copy in a view marks the message from the first character of the escape its first unit came from to the last
 * character of the escape its last unit came from. Copies that overlap in the message, from any reading, are one mark,
 * the mark of the lowest pass among them (`[secret]` before `[pii]`). Each reading costs steps linear in its length.
 * Each text is one mark, that of the first pass that holds a value, when a pass's set was open while the `onSecret`
 * slot was lost (`slotLost`, the lost pass's mark), when a set is past the cap (`automatonOf` is `"over"`), or when
 * the message is over `TEXT_CAP` characters, which is not read (k.serverlog). `count`, for tests, adds the walk's
 * steps and, when the matcher is built, the build's.
 */
export function scrubbed(
  message: string,
  passes: readonly (readonly [ReadonlySet<string>, string])[],
  count?: { build: number; walk: number },
): string {
  const lost = slotLost(passes.map(([values]) => values));
  if (lost !== undefined) return passes.find(([values]) => values === lost)?.[1] ?? "";
  const held = passes.find(([values]) => values.size > 0);
  if (held === undefined) return message;
  if (message.length > TEXT_CAP) return held[1];
  const a = automatonOf(
    passes.map(([values]) => values),
    count,
  );
  if (a === "over") return held[1];
  const { fold, go, fail, long, short, depth, pass, before, after } = a;
  const len = message.length;
  // Per message index: the furthest end of a copy starting there + 1 (0: none), and the lowest pass of those.
  let reach: Int32Array | undefined;
  let lowest: Int32Array | undefined;
  const mark = (v: View, from: number, to: number, p: number): void => {
    reach ??= new Int32Array(len + 1);
    lowest ??= new Int32Array(len + 1).fill(passes.length);
    const ra = v.first === undefined ? from : (v.first[from] ?? from);
    const rb = (v.last === undefined ? to - 1 : (v.last[to - 1] ?? to - 1)) + 1;
    reach[ra] = Math.max(reach[ra] ?? 0, rb);
    lowest[ra] = Math.min(lowest[ra] ?? 0, p);
  };
  let steps = 0;
  for (const v of readingsOf(message)) {
    const { units, n } = v;
    let s = 0;
    for (let i = 0; i < n; i++) {
      const c = fold[units[i] ?? 0] ?? 0;
      for (;;) {
        steps++;
        const g = go(s, c);
        if (g >= 0) {
          s = g;
          break;
        }
        if (s === 0) break;
        s = fail[s] ?? 0;
      }
      const t = long[s] ?? -1;
      if (t >= 0) {
        steps++;
        let from = i + 1 - (depth[t] ?? 0) - (before[t] ?? 0);
        let to = i + 1;
        if ((after[t] ?? 0) > 0) {
          to = Math.min(n, to + 1);
          while (to < n && units[to] === 61) to++;
        }
        from = Math.max(0, from);
        mark(v, from, to, pass[t] ?? 0);
      }
      // At most two: one of 2 units and one of 1.
      for (let q = short[s] ?? -1; q >= 0; q = short[fail[q] ?? 0] ?? -1) {
        steps++;
        const at = i + 1 - (depth[q] ?? 0);
        if (word(v, back(v, at)) || word(v, i + 1) || splits(v, at) || splits(v, i + 1)) continue;
        mark(v, at, i + 1, pass[q] ?? 0);
      }
    }
  }
  if (count !== undefined) count.walk += steps;
  if (reach === undefined || lowest === undefined) return message;
  const parts: string[] = [];
  let last = 0;
  let start = -1;
  let end = 0;
  let p = 0;
  for (let i = 0; i <= len; i++) {
    const r = i < len ? (reach[i] ?? 0) : 0;
    if (start >= 0 && (i >= end || i === len)) {
      parts.push(message.slice(last, start), passes[p]?.[1] ?? "");
      last = end;
      start = -1;
    }
    if (r === 0) continue;
    if (start < 0) {
      start = i;
      end = r;
      p = lowest[i] ?? 0;
    } else {
      end = Math.max(end, r);
      p = Math.min(p, lowest[i] ?? 0);
    }
  }
  parts.push(message.slice(last));
  return parts.join("");
}
