import type { Rung } from "../types/Rung.ts";

/** Rungs from lowest to highest (docs/TESTING.md); the index is the rank. */
export const RUNG_ORDER: readonly Rung[] = ["none", "monitored", "example", "probabilistic", "exhaustive", "proven"];
