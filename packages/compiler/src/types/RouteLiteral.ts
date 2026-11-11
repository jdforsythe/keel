/**
 * What `routeLiterals` read for one route of a routes manifest, in `routes.json` terms. A field is present only when it
 * was read as a literal: `path`, `layout`, `api` (when the entry has the member; absent means a page or layout), guard `redirect` (`null` when absent or
 * the guard has none), the action verbs, and whether `params`/`search` are declared (their schemas are not read).
 */
export type RouteLiteral = {
  readonly path?: string | null;
  readonly layout?: string | null;
  readonly api?: boolean;
  readonly guard?: string | null;
  readonly actions?: readonly string[];
  readonly params?: boolean;
  readonly search?: boolean;
};
