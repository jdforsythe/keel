import { defineTokens } from "@keel/ui";

export const tokens = defineTokens({
  color: {
    fg: { light: "#111111", dark: "#eeeeee" },
    bg: { light: "#ffffff", dark: "#111111" },
    accent: { light: "#006644", dark: "#33cc88" },
    danger: { light: "#b00020", dark: "#ff6b6b" },
  },
  space: { 0: "0", 1: "4px", 2: "8px", 3: "16px" },
  radius: { 1: "4px" },
  font: { body: "system-ui" },
  fontSize: { sm: "14px", md: "16px", lg: "24px" },
  weight: { bold: "700" },
  breakpoint: { md: "768px" },
  motion: { fast: "120ms" },
});
