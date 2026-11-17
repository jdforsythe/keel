import type { Located } from "@keel/router/internal";
import { secretKey } from "./secretKey.ts";

/** A request segment as a static one is compared to it: decoded once and lower-cased; `undefined` when it does not decode. */
const formOf = (part: string): string | undefined => {
  try {
    return decodeURIComponent(part).toLowerCase();
  } catch {
    return undefined;
  }
};

/**
 * The `req` path marker of a route table (k.privacy Sinks): given a request's pathname, each segment that stands where
 * a route's secret `params` field stands is `[secret]` whole, whatever the client sent there. Empty segments are
 * skipped. A route is lined up from the first non-empty segment by its segments up to and including the secret param:
 * a param fits any segment, a static segment fits one equal to it decoded once in either letter case, or one that does
 * not decode. A route led by a param (a prefix param, which a path may leave out) is also lined up without its first
 * segment. When a non-empty segment follows the secret one, the path is cut there: that segment and the rest become
 * one `[secret]`, so a value holding a raw `/` leaves no part and no slash count behind. With several routes lined up
 * the earliest cut wins and the marks before it stay. A path no route lines up with, and a table without a secret
 * param, give the path as it came. Each route costs at most its own length, so a path costs linear time in its length.
 */
export function secretSegments(table: readonly Located[]): (path: string) => string {
  const held = table.flatMap((r) => {
    const node = r.def.params?.node;
    if (node === undefined) return [];
    const want = r.segments.map((g) => (g.kind === "param" ? undefined : g.text.toLowerCase()));
    const skips = r.segments[0]?.kind === "param" ? [0, 1] : [0];
    return r.segments.flatMap((g, at) =>
      g.kind === "param" && secretKey(node, g.name)
        ? skips.filter((k) => k <= at).map((k) => ({ want: want.slice(k), at: at - k }))
        : [],
    );
  });
  if (held.length === 0) return (path) => path;
  return (path) => {
    const pieces = path.split("/");
    const where = pieces.flatMap((p, i) => (p === "" ? [] : [i]));
    const marked = new Set<number>();
    let cut = pieces.length;
    for (const { want, at } of held) {
      let lined = at < where.length;
      for (let j = 0; j < at && lined; j++) {
        const w = want[j];
        const form = formOf(pieces[where[j] ?? 0] ?? "");
        lined = w === undefined || form === undefined || form === w;
      }
      if (!lined) continue;
      const i = where[at] ?? pieces.length;
      if (at + 1 < where.length) cut = Math.min(cut, i);
      else marked.add(i);
    }
    if (marked.size === 0 && cut === pieces.length) return path;
    const kept = pieces.slice(0, cut).map((p, i) => (marked.has(i) ? "[secret]" : p));
    return cut < pieces.length ? [...kept, "[secret]"].join("/") : kept.join("/");
  };
}
