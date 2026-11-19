import type { Computed } from "@keel/reactive";
import type { StyleValues } from "../types/StyleValues.ts";
import type { PartState } from "./PartState.ts";

/** The style props of a part: what `Part` takes, and what a stdlib component's `styles` holds per part. */
export type PartStyle<D = Computed<string>> = StyleValues<D> & {
  readonly states?: { readonly [S in PartState]?: StyleValues<D> };
};
