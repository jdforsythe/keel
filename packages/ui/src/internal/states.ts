import type { StyleState } from "../types/StyleState.ts";

/** Interaction states in cascade order (later wins): class-name segment and CSS pseudo-class. */
export const states: readonly { readonly key: StyleState; readonly segment: string; readonly pseudo: string }[] = [
  { key: "hover", segment: "hover", pseudo: ":hover" },
  { key: "focusVisible", segment: "focus", pseudo: ":focus-visible" },
  { key: "active", segment: "active", pseudo: ":active" },
  { key: "disabled", segment: "disabled", pseudo: ":disabled" },
];
