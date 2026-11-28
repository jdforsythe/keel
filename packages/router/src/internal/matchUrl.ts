import { attempt, ok } from "@keel/schema";
import type { Located } from "./Located.ts";
import type { Match } from "./Match.ts";
import type { Segment } from "./Segment.ts";
import { parseSearch } from "./parseSearch.ts";
import { prefixOf } from "./prefixOf.ts";
import { splitUrl } from "./splitUrl.ts";
import { toRecord } from "./toRecord.ts";
import { undecodable } from "./undecodable.ts";
import { underMount } from "./underMount.ts";

const rank = (segments: readonly Segment[]): string => segments.map((s) => (s.kind === "static" ? "0" : "1")).join("");

/**
 * Match `url` against `table` segment by segment: a static segment beats `:param` (the lowest rank string
 * wins), no wildcards, a trailing slash is tolerated and dropped from the canonical `url`. Params are
 * URL-decoded then parsed by the route's params schema; failure is `notFound`. With a prefix param (k.prefix Parse):
 * a first segment that is a non-default value matches prefixed routes only; the default value matches the rest of the
 * path, and the canonical `url` leaves it out (the server answers 308 to it); any other path matches unprefixed
 * routes and prefixed routes with the default. A path whose decoded segments, joined by `/`, are `mount` (the router's
 * identity mount path, k.mount-scope) or lie under it matches nothing (`/%61pi/auth` under `/api/auth`; the test is
 * case-sensitive), nor does one holding a `\`, which a URL parser reads as `/` (so `/\x` would name the host `x`).
 */
export function matchUrl(table: readonly Located[], url: string, mount?: string): Match {
  const { path, query, hash } = splitUrl(url);
  const trimmed = path.length > 1 ? path.replace(/\/+$/, "") : path;
  const tail = `${query === "" ? "" : `?${query}`}${hash === "" ? "" : `#${hash}`}`;
  const canonical = `${trimmed === "" ? "/" : trimmed}${tail}`;
  const decoded = attempt(
    () => (trimmed === "/" || trimmed === "" ? [] : trimmed.slice(1).split("/").map(decodeURIComponent)),
    undecodable,
  );
  if (!decoded.ok || trimmed.includes("\\")) return { kind: "notFound", url: canonical, route: null };
  const parts = decoded.value;
  if (mount !== undefined && underMount(trimmed, mount)) return { kind: "notFound", url: canonical, route: null };
  const first = parts[0];
  const prefixes = table.map((r) => prefixOf(r.def, r.segments));
  const prefixed = first !== undefined && prefixes.some((x) => x?.values.includes(first) === true);
  let best: { route: Located; raw: Record<string, string>; rank: string; elided: boolean } | null = null;
  for (const [i, route] of table.entries()) {
    const pre = prefixes[i] ?? null;
    if (pre === null && prefixed) continue;
    const elided = pre !== null && first === pre.d;
    const implied = pre !== null && (first === undefined || !pre.values.includes(first));
    const segments = pre !== null && (elided || implied) ? route.segments.slice(1) : route.segments;
    const input = elided ? parts.slice(1) : parts;
    if (segments.length !== input.length) continue;
    const raw: Record<string, string> = pre !== null && (elided || implied) ? { [pre.name]: pre.d } : {};
    const fits = segments.every((s, j) => {
      const part = input[j] ?? "";
      if (s.kind === "static") return s.text === part;
      raw[s.name] = part;
      return part !== "";
    });
    const r = rank(segments);
    if (fits && (best === null || r < best.rank)) best = { route, raw, rank: r, elided };
  }
  if (best === null) return { kind: "notFound", url: canonical, route: null };
  const here = best.elided ? `${trimmed.replace(/^\/[^/]*/, "") || "/"}${tail}` : canonical;
  const { def } = best.route;
  const params = def.params === undefined ? ok({}) : def.params.decodeStrings(best.raw);
  if (!params.ok) return { kind: "notFound", url: here, route: best.route };
  return {
    kind: "route",
    url: here,
    route: best.route,
    params: toRecord(params.value),
    search: parseSearch(def.search, query),
  };
}
