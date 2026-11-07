import type { Doc } from "./Doc.ts";
import type { Issue } from "./Issue.ts";

/**
 * Generation state: the whole document (for `$ref`), the issues found so far, and the local consts emitted for
 * `#/components/schemas/<Name>` refs (name -> source, dependencies first), plus names that must stay inline.
 */
export type Gen = {
  readonly doc: Readonly<Record<string, unknown>>;
  readonly issues: Issue[];
  readonly named: Map<string, Doc>;
  readonly reserved: ReadonlySet<string>;
};
