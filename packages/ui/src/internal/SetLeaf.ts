import type { PartState } from "../aria/PartState.ts";
import type { StyleProp } from "../types/StyleProp.ts";

/** One (prop, token, breakpoint, state) of a style set; `breakpoint` undefined is `base`. */
export type SetLeaf = {
  readonly prop: StyleProp;
  readonly token: string;
  readonly breakpoint: string | undefined;
  readonly state: PartState | undefined;
};
