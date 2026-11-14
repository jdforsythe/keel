import { type Computed, computed } from "@keel/reactive";
import type { Named } from "./Named.ts";

/**
 * The `label` or `labelledBy` of a widget's props, bound for the part it names: which of the two is chosen at build,
 * and its value follows the prop.
 */
export function nameOf(props: Named): { readonly label: Computed<string> } | { readonly labelledBy: Computed<string> } {
  return props.label !== undefined
    ? { label: computed(() => props.label ?? "") }
    : { labelledBy: computed(() => props.labelledBy ?? "") };
}
