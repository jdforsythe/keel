import { gen } from "@keel/schema/gen";
import type { Transaction } from "@keel/store";
import * as fc from "fast-check";
import { checkComponent } from "./internal/checkComponent.ts";
import { checkTransaction } from "./internal/checkTransaction.ts";
import { fail } from "./internal/fail.ts";
import { jsonOf } from "./internal/jsonOf.ts";
import { propertyFailure } from "./internal/propertyFailure.ts";
import { seedFrom } from "./internal/seedFrom.ts";
import type { PropertyOptions } from "./types/PropertyOptions.ts";
import type { PropertyResult } from "./types/PropertyResult.ts";
import type { TestComponent } from "./types/TestComponent.ts";

/** Runs when `options.runs` is not given (k.testing Properties). */
const DEFAULT_RUNS = 100;

/**
 * Schema-generated properties (k.testing Properties). A component renders every generated `Props` value without
 * throwing or breaking an axe rule, and two renders with one seed are equal. A transaction, for every generated
 * store state satisfying the store's invariants and every generated payload, commits with every invariant holding,
 * is undone exactly, and is deterministic; the shrunk (payload, state) pair is reported. The seed is `options.seed`, else `KEEL_SEED`, else 1337. A failure throws E1704 with the seed,
 * the failing run, and the shrunk case; success resolves `{ seed, runs }`.
 */
export function properties<P>(target: TestComponent<P>, options?: PropertyOptions): Promise<PropertyResult>;
export function properties<T, P>(target: Transaction<T, P>, options?: PropertyOptions): Promise<PropertyResult>;
export async function properties<T, P>(
  target: TestComponent<P> | Transaction<T, P>,
  options: PropertyOptions = {},
): Promise<PropertyResult> {
  const seed = seedFrom(options.seed);
  const runs = options.runs ?? DEFAULT_RUNS;
  if (typeof target === "function") {
    const props = target.Props;
    if (props === undefined)
      throw fail("schema.invalid", "component has no Props (export `Props` from its file)", null);
    const out = fc.check(
      fc.property(gen(props), (p) => checkComponent(target, p, seed)),
      { seed, numRuns: runs },
    );
    if (out.failed && out.counterexample !== null) {
      const name = target.name === "" ? "component" : target.name;
      throw propertyFailure(name, out.errorInstance, seed, out.numRuns, [
        ["props", jsonOf(props, out.counterexample[0])],
      ]);
    }
  } else {
    const st = target.store;
    const out = fc.check(
      fc.property(gen(st.schema), gen(target.schema), (state, p) => {
        fc.pre(st.check(state).ok);
        checkTransaction(target, state, p);
      }),
      { seed, numRuns: runs },
    );
    if (out.failed && out.counterexample !== null) {
      const [state, p] = out.counterexample;
      throw propertyFailure(target.name, out.errorInstance, seed, out.numRuns, [
        ["payload", jsonOf(target.schema, p)],
        ["state", jsonOf(st.schema, state)],
      ]);
    }
    if (out.failed)
      throw propertyFailure(target.name, "too few generated states satisfy the invariants", seed, out.numRuns, []);
  }
  return { seed, runs };
}
