import type { TokenGroup } from "../types/TokenGroup.ts";
import type { AppTokens } from "./AppTokens.ts";

/** Token names of group `G` in the app's tokens, as strings (`space: { 2: ... }` gives `"2"`). */
export type TokenName<G extends TokenGroup> = G extends keyof AppTokens
  ? `${keyof NonNullable<AppTokens[G]> & (string | number)}`
  : never;
