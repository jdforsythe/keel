import type { Expression } from "oxc-parser";

/**
 * One value a local is given, at the offset `at` of its name. `key` is undefined when the local is `v` (an
 * initializer or an assignment to the name), a name when the local is destructured from `v` under that key first,
 * and null when it is another part of `v` or `v` is put into it. `field` is the field of the local a member write
 * gives `v` to (null: a computed key, so any field). `kept`: a member write or a mutation, which no later
 * assignment to the name hides.
 */
export type Given = {
  readonly at: number;
  readonly v: Expression;
  readonly key: string | null | undefined;
  readonly field: string | null | undefined;
  readonly kept: boolean;
};
