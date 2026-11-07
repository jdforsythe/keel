import type { Computed } from "@keel/reactive";
import type { StyleState } from "./StyleState.ts";
import type { StyleValues } from "./StyleValues.ts";

/**
 * Style props of a base element: values and state styles under one `states` prop
 * (`states={{ hover: { bg: 'accent' } }}`). The only way to style (RFC 0043: no `class`, no `styles()`).
 */
export type StyleProps<D = Computed<string>> = StyleValues<D> & {
  readonly states?: { readonly [S in StyleState]?: StyleValues<D> };
};
