import type { Computed } from "@keel/reactive";
import type { StyleState } from "./StyleState.ts";
import type { StyleValues } from "./StyleValues.ts";

/**
 * Style props of a base element: values, state styles under one `states` prop
 * (`states={{ hover: { bg: 'accent' } }}`), and `class` for scoped `styles` output.
 */
export type StyleProps<D = Computed<string>> = StyleValues<D> & {
  readonly states?: { readonly [S in StyleState]?: StyleValues<D> };
  readonly class?: string;
};
