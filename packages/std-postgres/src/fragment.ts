import { Fragment } from "./internal/Fragment.ts";

/**
 * A reusable piece of statement text (std.postgres): ``fragment`select id, title from recipes` ``. Each `${value}`
 * is a parameter, numbered where `sql` splices the fragment; a nested fragment is spliced the same way.
 */
export function fragment(strings: TemplateStringsArray, ...values: unknown[]): Fragment {
  return new Fragment(strings, values);
}
