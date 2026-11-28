import type { JsonValue, Schema } from "@keel/schema";
import { E1604 } from "./E1604.ts";

/** The capability `name`'s plan: each step of `steps` (default `[]`) parsed by `plan`; a step that fails is E1604. */
export function planOf(
  name: string,
  plan: Schema<unknown, boolean> | undefined,
  steps: readonly JsonValue[] = [],
): unknown[] {
  return steps.map((step, i) => {
    if (plan === undefined) return step;
    const r = plan.parse(step);
    if (!r.ok) throw E1604(`plan of "${name}" step ${i}: ${r.error.message}`);
    return r.value;
  });
}
