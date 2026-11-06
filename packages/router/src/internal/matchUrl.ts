import { attempt, ok } from "@keel/schema";
import type { Located } from "./Located.ts";
import type { Match } from "./Match.ts";
import { parseSearch } from "./parseSearch.ts";
import { splitUrl } from "./splitUrl.ts";
import { toRecord } from "./toRecord.ts";

const rank = (r: Located): string => r.segments.map((s) => (s.kind === "static" ? "0" : "1")).join("");

/**
 * Match `url` against `table` segment by segment: a static segment beats `:param` (the lowest rank string
 * wins), no wildcards, a trailing slash is tolerated and dropped from the canonical `url`. Params are
 * URL-decoded then parsed by the route's params schema; failure is `notFound`.
 */
export function matchUrl(table: readonly Located[], url: string): Match {
  const { path, query, hash } = splitUrl(url);
  const trimmed = path.length > 1 ? path.replace(/\/+$/, "") : path;
  const canonical = `${trimmed === "" ? "/" : trimmed}${query === "" ? "" : `?${query}`}${hash === "" ? "" : `#${hash}`}`;
  const decoded = attempt(() =>
    trimmed === "/" || trimmed === "" ? [] : trimmed.slice(1).split("/").map(decodeURIComponent),
  );
  if (!decoded.ok) return { kind: "notFound", url: canonical, route: null };
  const parts = decoded.value;
  let best: { route: Located; raw: Record<string, string> } | null = null;
  for (const route of table) {
    if (route.segments.length !== parts.length) continue;
    const raw: Record<string, string> = {};
    const fits = route.segments.every((s, i) => {
      const part = parts[i] ?? "";
      if (s.kind === "static") return s.text === part;
      raw[s.name] = part;
      return part !== "";
    });
    if (fits && (best === null || rank(route) < rank(best.route))) best = { route, raw };
  }
  if (best === null) return { kind: "notFound", url: canonical, route: null };
  const { def } = best.route;
  const params = def.params === undefined ? ok({}) : def.params.decodeStrings(best.raw);
  if (!params.ok) return { kind: "notFound", url: canonical, route: best.route };
  return {
    kind: "route",
    url: canonical,
    route: best.route,
    params: toRecord(params.value),
    search: parseSearch(def.search, query),
  };
}
