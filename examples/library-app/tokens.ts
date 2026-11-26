import { acmeTokens } from "@example/library-looks/tokens";
import { defineTokens } from "@keel/ui";
import { brandTokens } from "@keel/ui/brand";

export const tokens = defineTokens({
  ...brandTokens,
  schemes: ["light", "dark"],
  color: { ...brandTokens.color, ...acmeTokens.color, "acme.accent": "#b8420d", "acme.onAccent": "#ffffff" },
  space: { ...brandTokens.space, ...acmeTokens.space },
  size: { ...brandTokens.size, ...acmeTokens.size },
  radius: { ...brandTokens.radius, ...acmeTokens.radius, "acme.card": "0" },
  fontSize: { ...brandTokens.fontSize, ...acmeTokens.fontSize },
  border: { ...brandTokens.border, ...acmeTokens.border },
  look: { ...brandTokens.look, ...acmeTokens.look },
});
