import type { StyleProp } from "./StyleProp.ts";
import type { StyleState } from "./StyleState.ts";

/** One element's flat style props under one breakpoint and state, as the compiler extracts them. */
export type StyleUsage = {
  readonly props: Readonly<Partial<Record<StyleProp, string>>>;
  readonly breakpoint?: string;
  readonly state?: StyleState;
};
