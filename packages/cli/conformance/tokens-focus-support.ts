// Shared fixture for the tokens import and tokens set conformance (not a test file). Public API only.
// k.a11y Order and focus: a `base.focus` color under 3:1 against `base.page`'s `bg` in either scheme is E1807. `brandTokens`
// sets `focus: 'text'` and `page` on `surface`; k.cli's collection files give `surface` `#F9F9F9` in both schemes and `text`
// `#F3F3F3` in dark, 1.07:1, so the imported tokens fail that rule whatever the import under test wrote. The check halves
// of the clauses run on the same files with a dark `surface`, whose two ratios `focusRatios` computes.
const channel = (hex: string, at: number): number => {
  const v = Number.parseInt(hex.slice(1 + at * 2, 3 + at * 2), 16) / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string): number =>
  0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
/** WCAG contrast ratio of two `#rrggbb` colors. */
export const ratio = (a: string, b: string): number => {
  const [hi, lo] = [Math.max(luminance(a), luminance(b)), Math.min(luminance(a), luminance(b))];
  return (hi + 0.05) / (lo + 0.05);
};
export const LIGHT_TEXT = "#1a191e";
export const LIGHT_SURFACE = "#F9F9F9";
export const DARK_TEXT = "#F3F3F3";
/** A dark `surface` the dark `text` clears 3:1 on. */
export const DARK_SURFACE = "#141317";
/** The focus ring's ratios in each scheme: `text` on `surface`, as `brandTokens` sets `focus`. */
export const focusRatios = {
  light: ratio(LIGHT_TEXT, LIGHT_SURFACE),
  dark: ratio(DARK_TEXT, DARK_SURFACE),
  darkOnLightSurface: ratio(DARK_TEXT, LIGHT_SURFACE),
};
