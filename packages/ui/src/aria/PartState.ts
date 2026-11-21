import type { StyleState } from "../types/StyleState.ts";

/** A state a part's `states` takes: the interaction states and the widget states `selected`, `checked`, `expanded` and `highlighted`. */
export type PartState = StyleState | "selected" | "checked" | "expanded" | "highlighted";
