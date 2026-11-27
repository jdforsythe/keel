import { unsafe } from "./unsafe.ts";

/**
 * `passes` as a type guard for `T`: the schema's own check of its node, the one place an unknown value becomes the
 * `T` the node describes (k.identity What stays unsafe: a claim no other check establishes).
 */
export function checkedGuard<T>(
  passes: (x: unknown, copies: ReadonlySet<object>) => boolean,
): (x: unknown, copies?: ReadonlySet<object>) => x is T {
  return unsafe(
    "a value the schema's own check of its node passes is the T that node was built from, which no other check proves",
    () =>
      (x: unknown, copies: ReadonlySet<object> = new Set()): x is T =>
        passes(x, copies),
  );
}
