import { defineTokens } from "@keel/ui/tokens";
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
  themes: { hc: { when: "contrast", color: { ...acmeTokens.themes.contrast.color, error: "#8B1414" } } },
});
