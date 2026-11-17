import type { Located } from "@keel/router/internal";
import { secretKey } from "./secretKey.ts";

/** A segment folded for a lenient compare: NFKC, lower case, cut at `;`, outer spaces and trailing dots dropped. */
const fold = (s: string): string =>
  (s.normalize("NFKC").toLowerCase().split(";")[0] ?? "").replace(/^\s+/u, "").replace(/[\s.]+$/u, "");

/** A request segment folded after decoding it up to 4 times; `undefined` when a decode fails (it may be any segment). */
const formOf = (part: string): string | undefined => {
  let s = part;
  for (let i = 0; i < 4 && s.includes("%"); i++)
    try {
      s = decodeURIComponent(s);
    } catch {
      return undefined;
    }
  return fold(s);
};

/** True when `a` and `b` differ by at most one insertion, deletion, substitution or swap of two neighbours. */
const oneEdit = (a: string, b: string): boolean => {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length > b.length) return a.slice(i + 1) === b.slice(i);
  if (a.length < b.length) return a.slice(i) === b.slice(i + 1);
  const swapped = a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
  return a.slice(i + 1) === b.slice(i + 1) || swapped;
};

/** A request segment's form fits a route segment: any form fits a param (`undefined`); an undecodable form fits all. */
const fits = (form: string | undefined, want: string | undefined): boolean =>
  want === undefined || form === undefined || form === want || (want.length >= 4 && oneEdit(form, want));

/**
 * The `req` path marker of a route table (k.privacy Server log): given a request's pathname, each segment that may hold
 * a value sent for a route's secret `params` field is `[secret]` whole, whatever the client sent there. It fails
 * closed, so it marks more than the router matches. Empty segments are skipped. For each secret param, the route's
 * segments up to and including it are lined up with every run of the path's segments, so a leading segment the route
 * lacks (a locale, say) does not hide it: a param fits any segment, and a static segment fits one that equals it decoded
 * (up to 4 times), in either letter case, NFKC-normalized, cut at `;`, without outer spaces or trailing dots, or that is
 * one edit (insertion, deletion, substitution, neighbour swap) from a static segment of 4 or more characters, or that
 * does not decode. Where a run lines up, the segment at the secret param is marked, and so is every later segment that
 * the route's own static segment at that place does not fit (a tail past the route, a param after the secret one), since
 * a value split by a slash may run on into it. Only routes with a secret param are kept, so a table without one returns
 * each path as it came.
 */
export function secretSegments(table: readonly Located[]): (path: string) => string {
  const held = table.flatMap((r) => {
    const node = r.def.params?.node;
    if (node === undefined) return [];
    const want = r.segments.map((g) => (g.kind === "param" ? undefined : fold(g.text)));
    return r.segments.flatMap((g, at) => (g.kind === "param" && secretKey(node, g.name) ? [{ want, at }] : []));
  });
  if (held.length === 0) return (path) => path;
  return (path) => {
    const pieces = path.split("/");
    const where = pieces.flatMap((p, i) => (p === "" ? [] : [i]));
    const forms = where.map((i) => formOf(pieces[i] ?? ""));
    const marked = new Set<number>();
    // Every segment from `tail` on lies past some lined-up route, so all of them are marked in one pass at the end.
    let tail = forms.length;
    for (const { want, at } of held)
      for (let o = 0; o + at < forms.length; o++) {
        let lined = true;
        for (let j = 0; j <= at && lined; j++) lined = fits(forms[o + j], want[j]);
        if (!lined) continue;
        marked.add(o + at);
        const end = Math.min(o + want.length, forms.length);
        for (let t = o + at + 1; t < end; t++)
          if (want[t - o] === undefined || !fits(forms[t], want[t - o])) marked.add(t);
        tail = Math.min(tail, end);
      }
    for (let t = tail; t < forms.length; t++) marked.add(t);
    if (marked.size === 0) return path;
    const out = new Set([...marked].map((k) => where[k]));
    return pieces.map((p, i) => (out.has(i) ? "[secret]" : p)).join("/");
  };
}
