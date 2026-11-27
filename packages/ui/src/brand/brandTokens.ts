import type { Tokens } from "../types/Tokens.ts";

/**
 * The Keel brand as tokens (docs/BRAND.md): parchment surface, charcoal text, ISO Ochre `accent` reserved for
 * status badges, conformance markers and active diagnostics; Source Serif 4 and JetBrains Mono (self-hosted:
 * `@keel/ui/fonts`); radius 0; hairline dividers: `border="hairline"` frames a block, a `h="hairline" bg="divider"`
 * Box rules between blocks, and `gap="hairline"` over `bg="divider"` rules between rows.
 * `base` puts the guide on every page with no app code (page, headings, links, buttons, controls, labels, field
 * errors, the no-script summary, and a 2px Charcoal focus ring); `look` names `primary`, `secondary` and `control`.
 * Light only: the brand defines one scheme. Color names are alphanumeric so `border` values can name their
 * custom properties (`var(--k-color-divider)`).
 * Plain data, so a client component may read a value without carrying `@keel/ui/tokens`: `keel check` and
 * `keel build` validate it with `TokenSchema` as an app's `tokens.ts`, and the package's tests do too.
 */
export const brandTokens = {
  color: {
    surface: "#F9F9F9",
    surfaceLow: "#F3F3F3",
    card: "#FFFFFF",
    text: "#1a191e",
    textSecondary: "#6B6B74",
    accent: "#b8420d",
    verified: "#15803D",
    error: "#B91C1C",
    divider: "#E4E4E7",
  },
  space: {
    0: "0",
    hairline: "1px",
    1: "4px",
    2: "8px",
    3: "16px",
    4: "24px",
    5: "32px",
    6: "48px",
    7: "64px",
    auto: "auto",
  },
  size: { hairline: "1px", mark: "32px", full: "100%", measure: "44rem" },
  radius: { none: "0" },
  font: {
    serif: '"Source Serif 4", Georgia, serif',
    mono: '"JetBrains Mono", ui-monospace, monospace',
  },
  fontSize: { xs: "12px", sm: "14px", md: "17px", lg: "21px", xl: "28px", "2xl": "40px" },
  weight: { regular: "400", medium: "500", semibold: "600", bold: "700" },
  border: {
    none: "0",
    hairline: "1px solid var(--k-color-divider)",
    rule: "1px solid var(--k-color-text)",
    control: "1px solid var(--k-color-textSecondary)",
    accent: "1px solid var(--k-color-accent)",
    verified: "1px solid var(--k-color-verified)",
    error: "1px solid var(--k-color-error)",
  },
  breakpoint: { md: "768px", lg: "1024px" },
  motion: { fast: "120ms" },
  base: {
    page: { font: "serif", fontSize: "md", fg: "text", bg: "surface" },
    heading: { font: "serif", weight: "semibold", fg: "text" },
    link: { fg: "text", states: { hover: { fg: "textSecondary" } } },
    button: {
      font: "mono",
      fontSize: "sm",
      weight: "medium",
      px: "4",
      py: "2",
      bg: "text",
      fg: "card",
      border: "rule",
      radius: "none",
    },
    control: {
      font: "mono",
      fontSize: "sm",
      w: "full",
      px: "2",
      py: "2",
      bg: "card",
      fg: "text",
      border: "control",
      radius: "none",
      states: { hover: { border: "rule" } },
    },
    label: { font: "mono", fontSize: "sm", fg: "text" },
    fieldError: { font: "mono", fontSize: "sm", fg: "error" },
    summary: { p: "3", bg: "card", fg: "error", border: "error", font: "mono", fontSize: "sm" },
    focus: "text",
  },
  look: {
    control: {
      font: "mono",
      fontSize: "sm",
      w: "full",
      px: "2",
      py: "2",
      bg: "card",
      fg: "text",
      border: "control",
      radius: "none",
      states: { hover: { border: "rule" } },
    },
    primary: {
      font: "mono",
      fontSize: "sm",
      weight: "medium",
      px: "4",
      py: "2",
      bg: "text",
      fg: "card",
      border: "rule",
      radius: "none",
    },
    secondary: {
      font: "mono",
      fontSize: "sm",
      px: "3",
      py: "2",
      bg: "card",
      fg: "text",
      border: "rule",
      radius: "none",
      states: { hover: { bg: "surfaceLow" } },
    },
  },
} as const satisfies Tokens;
