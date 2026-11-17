import type { EndpointMap } from "@keel/services";
import type { Output } from "./Output.ts";

/** The union of the outputs of every endpoint of `D`: what a re-sent entry may answer, since its key names none. */
export type Outputs<D extends EndpointMap> = { readonly [K in keyof D]: Output<D, K> }[keyof D];
