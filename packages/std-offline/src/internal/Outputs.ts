import type { Output } from "./Output.ts";

/** The union of the outputs of every endpoint of `D`: what a re-sent entry may answer, since its key names none. */
export type Outputs<D extends object> = { readonly [K in keyof D]: Output<D, K> }[keyof D];
