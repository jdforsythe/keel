import type { parseSync } from "oxc-parser";
import type { Solver } from "./Solver.ts";

/** What `prove` loads on first use: oxc's parser, a Z3 context per check, and the Z3 version (`5.3.3`). */
export interface Tools {
  readonly parse: typeof parseSync;
  open(): Solver;
  readonly version: string;
}
