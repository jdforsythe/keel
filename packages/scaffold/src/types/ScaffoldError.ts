import type { KeelError } from "@keel/schema";
import type { ScaffoldDiag } from "./ScaffoldDiag.ts";

/** An operation refused: nothing written. `data` is the diagnostic (E1351-E1354, E1005, E1051, E1052). */
export type ScaffoldError = KeelError<"scaffold.rejected", ScaffoldDiag>;
