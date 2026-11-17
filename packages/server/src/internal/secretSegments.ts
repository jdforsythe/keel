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
 * The `req` path marker of a route table (k.privacy Server log): given a request's pathname, each segment that stands
 * where a route's secret `params` field stands is `[secret]` whole, whatever the client sent there. Empty segments are
 * skipped. A route is lined up from the first non-empty segment by its segments up to and including the secret param,
 * the rest of the path ignored: a param fits any segment, a static segment fits one equal to it decoded once in either
 * letter case, or one that does not decode. A route led by a param (a prefix param, which a path may leave out) is also
 * lined up without its first segment. Only the segments at a secret param are marked. A table without a secret param
 * returns each path as it came.
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
    for (const { want, at } of held) {
      let lined = at < where.length;
      for (let j = 0; j < at && lined; j++) {
        const w = want[j];
        const form = formOf(pieces[where[j] ?? 0] ?? "");
        lined = w === undefined || form === undefined || form === w;
      }
      if (lined) marked.add(where[at] ?? -1);
    }
    if (marked.size === 0) return path;
    return pieces.map((p, i) => (marked.has(i) ? "[secret]" : p)).join("/");
  };
}
