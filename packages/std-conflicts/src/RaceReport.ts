import type { Race } from "./Race.ts";
import type { Unchecked } from "./Unchecked.ts";

/** What `races` finds (std.conflicts), each list in log order. */
export interface RaceReport {
  readonly races: readonly Race[];
  readonly unchecked: readonly Unchecked[];
}
