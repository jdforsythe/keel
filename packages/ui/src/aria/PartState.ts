import type { StyleState } from "../types/StyleState.ts";

/**
 * A state a part's `states` takes (k.aria Part styles): the interaction states and the widget states `selected`,
 * `checked`, `pressed`, `expanded`, `current` and `highlighted`.
 */
export type PartState = StyleState | "selected" | "checked" | "pressed" | "expanded" | "current" | "highlighted";
