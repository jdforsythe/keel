/** `tokens.ts` (k.ui): the Keel brand token set (docs/BRAND.md) from `@keel/ui/brand`. */
export function tokensTs(): string {
  return [`import { brandTokens } from "@keel/ui/brand";`, "", "export const tokens = brandTokens;", ""].join("\n");
}
