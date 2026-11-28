import type { Located } from "@keel/router/internal";
import { piiPaths } from "@keel/schema";
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
 * a route's secret `params` field stands is `[secret]` whole, whatever the client sent there, and where a `.pii()` one
 * stands (the field or a node above it marked) `[pii]`; `[secret]` wins where both fall on one segment. Empty segments
 * are skipped. A route is lined up from the first non-empty segment by its segments up to and including the marked
 * param: a param fits any segment, a static segment fits one equal to it decoded once in either letter case, or one
 * that does not decode. A route led by a param (a prefix param, which a path may leave out) is also lined up without
 * its first segment. A mark or a cut takes in the `/`s before its segment but one, and a mark at the last non-empty
 * segment the `/`s after it, so no slash of a value is left; slashes before a static segment stay. When a non-empty segment follows the marked one, the path is cut there: that segment and the rest
 * become one mark, so a value holding a raw `/` leaves no part and no slash count behind. When the table has a secret
 * param, the first segment whose raw text holds `%2F` or `%5C` in either case is a cut as `[secret]` too. With several
 * cuts the earliest wins, `[secret]` at a tie, and the marks before it stay. A path no route lines up with, and a table
 * without a marked param, give the path as it came. Each route costs at most its own length, so a path costs linear
 * time in its length.
 */
export function secretSegments(table: readonly Located[]): (path: string) => string {
  const held = table.flatMap((r) => {
    const params = r.def.params;
    if (params === undefined) return [];
    const pii = piiPaths(params).map((p) => p.path.split(".")[0]);
    const want = r.segments.map((g) => (g.kind === "param" ? undefined : g.text.toLowerCase()));
    const skips = r.segments[0]?.kind === "param" ? [0, 1] : [0];
    return r.segments.flatMap((g, at) => {
      const mark =
        g.kind !== "param" ? "" : secretKey(params.node, g.name) ? "[secret]" : pii.includes(g.name) ? "[pii]" : "";
      return mark ? skips.filter((k) => k <= at).map((k) => ({ want: want.slice(k), at: at - k, mark })) : [];
    });
  });
  // Secret marks first, so the first mark or cut to land on a segment is the one that wins there.
  held.sort((x, y) => y.mark.length - x.mark.length);
  const sep = held[0]?.mark === "[secret]";
  return (path) => {
    const pieces = path.split("/");
    const where = pieces.flatMap((p, i) => (p === "" ? [] : [i]));
    const marked: string[] = [];
    const e = sep ? pieces.findIndex((p) => /%(2f|5c)/i.test(p)) : -1;
    let cut = e < 0 ? pieces.length : e;
    let tail = "[secret]";
    for (const { want, at, mark } of held) {
      let lined = at < where.length;
      for (let j = 0; j < at && lined; j++) {
        const w = want[j];
        const form = formOf(pieces[where[j] ?? 0] ?? "");
        lined = w === undefined || form === undefined || form === w;
      }
      if (!lined) continue;
      const i = where[at] ?? pieces.length;
      if (at + 1 >= where.length) marked[i] ??= mark;
      else if (i < cut) {
        cut = i;
        tail = mark;
      }
    }
    // The text is rebuilt from the non-empty segments and the runs of `/` between them. A mark or the cut keeps one
    // slash before it (none at the path's very start when there was none); a mark at the last segment drops the
    // slashes after it, and the cut takes the rest of the path.
    let out = "";
    let prev = -1;
    for (const i of where) {
      if (i >= cut) break;
      const gap = i - (prev < 0 ? 0 : prev);
      const m = marked[i];
      out += "/".repeat(m !== undefined && gap > 0 ? 1 : gap) + (m ?? pieces[i] ?? "");
      prev = i;
    }
    if (cut < pieces.length) return `${out}${"/".repeat(cut - (prev < 0 ? 0 : prev) > 0 ? 1 : 0)}${tail}`;
    const last = where[where.length - 1];
    if (last === undefined) return "/".repeat(pieces.length - 1);
    return out + (marked[last] === undefined ? "/".repeat(pieces.length - 1 - last) : "");
  };
}
