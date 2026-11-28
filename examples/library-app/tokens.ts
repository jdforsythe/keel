import { acmeTokens } from "@example/library-looks/tokens";
import { defineTokens } from "@keel/ui/tokens";
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
  themes: {
    slate: { color: { surface: "#F4F7FB", "acme.accent": "#0B5CAD" } },
    hc: {
      when: "contrast",
      color: { ...acmeTokens.themes.contrast.color, "acme.accent": "#08427D", error: "#8B1414" },
    },
    paper: { when: "print", color: { surface: "#FFFFFF", card: "#FFFFFF", text: "#000000" } },
  },
});
