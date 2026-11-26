import { defineTokens } from "@keel/ui";

export const acmeTokens = defineTokens({
  color: {
    "acme.surface": { light: "#FFFFFF", dark: "#1C1B20" },
    "acme.text": { light: "#1A191E", dark: "#F3F3F3" },
    "acme.accent": { light: "#0B5CAD", dark: "#8AB8F0" },
    "acme.onAccent": { light: "#FFFFFF", dark: "#0B1A2B" },
    "acme.track": { light: "#6B6B74", dark: "#A1A1AA" },
    "acme.knob": { light: "#FFFFFF", dark: "#1C1B20" },
  },
  space: { "acme.1": "4px", "acme.2": "8px", "acme.3": "16px" },
  size: { "acme.trackW": "36px", "acme.knob": "16px" },
  radius: { "acme.card": "4px", "acme.round": "999px" },
  fontSize: { "acme.badge": "12px" },
  border: { "acme.card": "1px solid var(--k-color-acme-track)" },
  look: {
    "acme.card": {
      direction: "column",
      gap: "acme.2",
      p: "acme.3",
      bg: "acme.surface",
      fg: "acme.text",
      radius: "acme.card",
      border: "acme.card",
    },
    "acme.badge": {
      px: "acme.2",
      py: "acme.1",
      radius: "acme.round",
      bg: "acme.accent",
      fg: "acme.onAccent",
      fontSize: "acme.badge",
    },
    "acme.switch": {
      direction: "row",
      align: "center",
      w: "acme.trackW",
      p: "acme.1",
      radius: "acme.round",
      bg: "acme.track",
      fg: "acme.knob",
      states: { checked: { bg: "acme.accent", justify: "end" } },
    },
    "acme.knob": { w: "acme.knob", h: "acme.knob", radius: "acme.round", bg: "acme.knob", fg: "acme.text" },
  },
});
