import type { Instance } from "../Instance.ts";
import type { FlowInput } from "./FlowInput.ts";
import type { LooseStores } from "./LooseStores.ts";

/** The instance a job's input names, while it is still at that `entered` and `test` holds for its state; else undefined. */
export function rowOf<S extends string, D>(
  S: LooseStores<S, D>,
  input: FlowInput,
  test: (state: string) => boolean,
): Instance<S, D> | undefined {
  const r = S.store.get("instances")[input.id];
  return r !== undefined && r.entered === input.entered && test(r.state) ? r : undefined;
}
