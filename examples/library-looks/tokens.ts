import { defineTokens } from "@keel/ui";
import { brandTokens } from "@keel/ui/brand";
import { acmeTokens } from "./src/acmeTokens.ts";

export const tokens = defineTokens({
  ...brandTokens,
  color: { ...brandTokens.color, ...acmeTokens.color },
  space: { ...brandTokens.space, ...acmeTokens.space },
  size: { ...brandTokens.size, ...acmeTokens.size },
  radius: { ...brandTokens.radius, ...acmeTokens.radius },
  fontSize: { ...brandTokens.fontSize, ...acmeTokens.fontSize },
  border: { ...brandTokens.border, ...acmeTokens.border },
  look: { ...brandTokens.look, ...acmeTokens.look },
});
