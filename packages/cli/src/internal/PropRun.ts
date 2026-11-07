import type { NumRef } from "./NumRef.ts";

/** One property run a body performs (`fc.assert`/`fc.check`, `properties`): its runs and seed as written. */
export type PropRun = { readonly runs: NumRef; readonly seed: NumRef };
