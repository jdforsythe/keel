import { tokensError } from "../internal/tokensError.ts";
import type { Tokens } from "../types/Tokens.ts";
import { TokenSchema } from "./TokenSchema.ts";

/**
 * Declare the app's tokens (`tokens.ts`). Returns them unchanged with literal names preserved;
 * throws an Error with `code: 'E1807'`, its message `<path>: <what>` and the issues, when they fail `TokenSchema`.
 */
export function defineTokens<const T extends Tokens>(tokens: T): T {
  const r = TokenSchema.parse(tokens);
  if (!r.ok) throw tokensError(r.error);
  return tokens;
}
