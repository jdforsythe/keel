import { registry } from "./internal/registry.ts";
import type { RuleDef } from "./types/RuleDef.ts";

/** Every registered rule (kernel and stdlib), sorted by code. */
export function rules(): RuleDef[] {
  return [...registry.values()].sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
}
