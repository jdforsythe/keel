import type { Tokens } from "../types/Tokens.ts";
import { tokenIssues } from "./tokenIssues.ts";

/** Type guard: `x` fits the closed token file shape. */
export function isTokens(x: unknown): x is Tokens {
  return tokenIssues(x).length === 0;
}
