import type { Evidence } from "../types/Evidence.ts";
import type { Rung } from "../types/Rung.ts";

/** Seeded property runs needed to claim `probabilistic` (k.ledger). */
const MIN_RUNS = 100;

/** The rung one piece of passing evidence supports; failing evidence supports nothing. */
export function rungOf(ev: Evidence): Rung {
  if (!ev.passed) return "none";
  switch (ev.kind) {
    case "example":
      return "example";
    case "property":
      return (ev.runs ?? 0) >= MIN_RUNS && ev.seed !== undefined ? "probabilistic" : "example";
    case "exhaustive":
      return "exhaustive";
    case "proven":
      return "proven";
    case "monitored":
      return "monitored";
  }
}
