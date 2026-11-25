import type { View } from "./View.ts";

const hexOf = (c: number): number =>
  c >= 48 && c <= 57 ? c - 48 : c >= 65 && c <= 70 ? c - 55 : c >= 97 && c <= 102 ? c - 87 : -1;

/** The length of the well-formed UTF-8 sequence starting at `b[k]` of `b[0..m)`, or 0. */
const sequence = (b: Uint8Array, k: number, m: number): number => {
  const b0 = b[k] ?? 0;
  const cont = (j: number, lo = 0x80, hi = 0xbf): boolean =>
    k + j < m && (b[k + j] ?? 0) >= lo && (b[k + j] ?? 0) <= hi;
  if (b0 < 0x80) return 1;
  if (b0 >= 0xc2 && b0 <= 0xdf) return cont(1) ? 2 : 0;
  if (b0 >= 0xe0 && b0 <= 0xef) {
    const lo = b0 === 0xe0 ? 0xa0 : 0x80;
    const hi = b0 === 0xed ? 0x9f : 0xbf;
    return cont(1, lo, hi) && cont(2) ? 3 : 0;
  }
  if (b0 >= 0xf0 && b0 <= 0xf4) {
    const lo = b0 === 0xf0 ? 0x90 : 0x80;
    const hi = b0 === 0xf4 ? 0x8f : 0xbf;
    return cont(1, lo, hi) && cont(2) && cont(3) ? 4 : 0;
  }
  return 0;
};

// The characters after `\` that stand for one unit, and that unit.
const ESCAPED = new Map<number, number>([
  [34, 34],
  [92, 92],
  [47, 47],
  [98, 8],
  [102, 12],
  [110, 10],
  [114, 13],
  [116, 9],
]);
const NAMED: readonly (readonly [string, number])[] = [
  ["amp;", 38],
  ["lt;", 60],
  ["gt;", 62],
  ["quot;", 34],
  ["apos;", 39],
];

/**
 * The decoded view of `src` (k.privacy Views), read once from the start: a run of `%` and two hex digits (either case)
 * as bytes, each well-formed UTF-8 sequence among them as its code point and any other byte as its three characters;
 * `+` as a space, or as `+` when `plus` is true; `\u` and four hex digits as that unit; `\"`, `\\`, `\/`, `\b`, `\f`,
 * `\n`, `\r` and `\t` as their characters; `&amp;`, `&lt;`, `&gt;`, `&quot;` and `&apos;`, `&#` with 1 to 7 decimal
 * digits and `;`, and `&#x` or `&#X` with 1 to 6 hex digits and `;`, as their character, a numeric one only for a code
 * point up to U+10FFFF that is no surrogate; any other unit as is. Each unit of the view maps to the first and last
 * character of the raw text its escape came from, through `src`'s own maps, so a view of a view maps to the raw text.
 * `family` names the escapes read: `"all"`, or one family alone (`"url"`: `%` escapes and `+`; `"json"`: the
 * backslash ones; `"html"`: entities), a unit of another family then as is. `undefined` when the view is `src` itself (nothing read as an escape). No unit is written twice and no escape is
 * shorter than what it stands for, so the view is at most `src.n` units, made in steps linear in `src.n`.
 */
export function decodedView(
  src: View,
  plus: boolean,
  family: "all" | "url" | "json" | "html" = "all",
): View | undefined {
  const url = family === "all" || family === "url";
  const json = family === "all" || family === "json";
  const html = family === "all" || family === "html";
  const { units: u, n } = src;
  const units = new Uint16Array(n);
  const first = new Int32Array(n);
  const last = new Int32Array(n);
  let bytes: Uint8Array | undefined;
  let at: Int32Array | undefined;
  let o = 0;
  let changed = false;
  const put = (unit: number, a: number, b: number): void => {
    units[o] = unit;
    first[o] = src.first === undefined ? a : (src.first[a] ?? a);
    last[o] = src.last === undefined ? b : (src.last[b] ?? b);
    o++;
  };
  const putPoint = (cp: number, a: number, b: number): void => {
    if (cp < 0x10000) put(cp, a, b);
    else {
      put(0xd800 + ((cp - 0x10000) >> 10), a, b);
      put(0xdc00 + ((cp - 0x10000) & 0x3ff), a, b);
    }
  };
  let i = 0;
  while (i < n) {
    const c = u[i] ?? 0;
    if (url && c === 37 && i + 2 < n && hexOf(u[i + 1] ?? 0) >= 0 && hexOf(u[i + 2] ?? 0) >= 0) {
      bytes ??= new Uint8Array(Math.floor(n / 3) + 1);
      at ??= new Int32Array(Math.floor(n / 3) + 1);
      let m = 0;
      let j = i;
      while (j + 2 < n && u[j] === 37 && hexOf(u[j + 1] ?? 0) >= 0 && hexOf(u[j + 2] ?? 0) >= 0) {
        bytes[m] = hexOf(u[j + 1] ?? 0) * 16 + hexOf(u[j + 2] ?? 0);
        at[m++] = j;
        j += 3;
      }
      for (let k = 0; k < m; ) {
        const len = sequence(bytes, k, m);
        const p = at[k] ?? 0;
        if (len === 0) {
          put(u[p] ?? 0, p, p);
          put(u[p + 1] ?? 0, p + 1, p + 1);
          put(u[p + 2] ?? 0, p + 2, p + 2);
          k++;
          continue;
        }
        const b0 = bytes[k] ?? 0;
        let cp = len === 1 ? b0 : len === 2 ? b0 & 0x1f : len === 3 ? b0 & 0x0f : b0 & 0x07;
        for (let x = 1; x < len; x++) cp = (cp << 6) | ((bytes[k + x] ?? 0) & 0x3f);
        putPoint(cp, p, (at[k + len - 1] ?? 0) + 2);
        changed = true;
        k += len;
      }
      i = j;
      continue;
    }
    if (url && c === 43) {
      put(plus ? 43 : 32, i, i);
      if (!plus) changed = true;
      i++;
      continue;
    }
    if (json && c === 92 && i + 1 < n) {
      const d = u[i + 1] ?? 0;
      if (d === 117 && i + 5 < n) {
        const h = [2, 3, 4, 5].map((k) => hexOf(u[i + k] ?? 0));
        if (h.every((x) => x >= 0)) {
          put(
            h.reduce((acc, x) => acc * 16 + x, 0),
            i,
            i + 5,
          );
          changed = true;
          i += 6;
          continue;
        }
      }
      const e = ESCAPED.get(d);
      if (e !== undefined) {
        put(e, i, i + 1);
        changed = true;
        i += 2;
        continue;
      }
    }
    if (html && c === 38) {
      const end = entityEnd(u, n, i);
      if (end !== undefined) {
        putPoint(end[1], i, end[0]);
        changed = true;
        i = end[0] + 1;
        continue;
      }
    }
    put(c, i, i);
    i++;
  }
  if (!changed) return undefined;
  return { units, n: o, first, last };
}

/** For an entity the views read starting at `&` at `i`: the index of its `;` and its code point. */
function entityEnd(u: Uint16Array, n: number, i: number): readonly [number, number] | undefined {
  for (const [name, cp] of NAMED) {
    if (i + name.length >= n) continue;
    let same = true;
    for (let k = 0; k < name.length && same; k++) same = u[i + 1 + k] === name.charCodeAt(k);
    if (same) return [i + name.length, cp];
  }
  if (u[i + 1] !== 35) return undefined;
  const hex = u[i + 2] === 120 || u[i + 2] === 88;
  const most = hex ? 6 : 7;
  let j = hex ? i + 3 : i + 2;
  const from = j;
  let cp = 0;
  while (j < n && j - from < most) {
    const d = hexOf(u[j] ?? 0);
    if (d < 0 || (!hex && d > 9)) break;
    cp = cp * (hex ? 16 : 10) + d;
    j++;
  }
  if (j === from || u[j] !== 59) return undefined;
  if (cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return undefined;
  return [j, cp];
}
