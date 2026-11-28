/**
 * What `routeLiterals` read for one route, in `routes.json` terms. A field is present only when it was read as a
 * literal: from the contract entry, `path` (`null` for a layout), `api: true` and `method` for an API entry, and
 * whether `params` and `search` (an API entry's `query`) are declared (their schemas are not read), `local: true` for a
 * `local` entry (k.contract Local routes); from the binding,
 * `layout`, guard `redirect` (`null` when absent or the guard has none) and the action verbs. `file` is where the id
 * is declared: the contract file, project-relative, or a stdlib module's `./contract` specifier.
 */
export type RouteLiteral = {
  readonly file?: string;
  readonly path?: string | null;
  readonly method?: string;
  readonly layout?: string | null;
  readonly api?: boolean;
  readonly local?: boolean;
  readonly guard?: string | null;
  readonly actions?: readonly string[];
  readonly params?: boolean;
  readonly search?: boolean;
};
