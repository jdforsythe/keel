import type { RouteLiterals } from "@keel/compiler";

const isRecord = (v: unknown): v is Readonly<Record<string, unknown>> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const sameList = (a: unknown, b: readonly string[]): boolean =>
  Array.isArray(a) && a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * The first route id (sorted) where `routes.json` `data` differs from the literals of `routes.ts` (k.compiler
 * Artifacts), or undefined. A literal id missing from `data`, or a read field that differs (`path`, `layout`, `api`
 * (absent means not an API route), guard `redirect`, `actions`, `params`/`search` presence, `module` from the id), is a mismatch; so is an
 * id in `data` the literals lack when every id was a literal (`closed`).
 */
export function routesMismatch(data: unknown, literals: RouteLiterals): string | undefined {
  if (!isRecord(data)) return "";
  const ids = new Set([...Object.keys(literals.routes), ...(literals.closed ? Object.keys(data) : [])]);
  for (const id of [...ids].sort()) {
    const want = literals.routes[id];
    const got = data[id];
    if (want === undefined || !isRecord(got)) return id;
    const differs =
      got.module !== (id.split(".")[0] ?? id) ||
      (want.path !== undefined && got.path !== want.path) ||
      (want.layout !== undefined && got.layout !== want.layout) ||
      (!literals.unread.includes(id) &&
        !literals.unread.includes(`${id} api`) &&
        (got.api === true) !== (want.api === true)) ||
      (want.guard !== undefined && got.guard !== want.guard) ||
      (want.actions !== undefined && !sameList(got.actions, want.actions)) ||
      (want.params !== undefined && (got.params !== null) !== want.params) ||
      (want.search !== undefined && (got.search !== null) !== want.search);
    if (differs) return id;
  }
  return undefined;
}
