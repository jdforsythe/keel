import { TokenSchema } from "./TokenSchema.ts";
import type { Tokens } from "./types/Tokens.ts";

/**
 * Declare the app's tokens (`tokens.ts`). Returns them unchanged with literal names preserved;
 * throws an Error with `code: 'E1807'` when they fail `TokenSchema`.
 */
export function defineTokens<const T extends Tokens>(tokens: T): T {
  const r = TokenSchema.parse(tokens);
  if (!r.ok) throw Object.assign(new Error(`tokens fail TokenSchema: ${r.error.message}`), { code: "E1807" });
  return tokens;
}
