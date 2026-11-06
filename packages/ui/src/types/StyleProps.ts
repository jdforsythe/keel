import type { Computed } from "@keel/reactive";
import type { StyleState } from "./StyleState.ts";
import type { StyleValues } from "./StyleValues.ts";

/** Style props of a base element: values, per-state nested values, and `class` for scoped `styles` output. */
export type StyleProps<D = Computed<string>> = StyleValues<D> & { readonly [S in StyleState]?: StyleValues<D> } & {
  readonly class?: string;
};
