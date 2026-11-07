/**
 * What `routeLiterals` read for one route of a routes manifest (rfc:0059), in `routes.json` terms. A field is present
 * only when it was read as a literal: `path`, `layout`, guard `redirect` (`null` when absent), the action verbs, and
 * whether `params`/`search` are declared (their schemas are not read).
 */
export type RouteLiteral = {
  readonly path?: string | null;
  readonly layout?: string | null;
  readonly guard?: string | null;
  readonly actions?: readonly string[];
  readonly params?: boolean;
  readonly search?: boolean;
};
