import type { Diag } from "./Diag.ts";

/**
 * The records of one thrown value (k.serverlog Thrown values, `thrownLog`): given the record's code, the server's
 * `lead` (`loader <id> threw: `), the value and its app frames, the `diag` of its form and, while full text is on, the
 * one of its text. Both keep `lead`, so `scrubbedDiag` keeps it past a scrub cap.
 */
export type ThrownRecords = (code: string, lead: string, thrown: unknown, frames: readonly string[]) => Diag[];
