import { colorSyntax } from "../internal/colorSyntax.ts";
import { colorLinear } from "./colorLinear.ts";
import { gamutMap } from "./gamutMap.ts";

type Rgb = readonly [number, number, number];

const luminance = ([r, g, b]: Rgb): number => Math.min(1, Math.max(0, 0.2126 * r + 0.7152 * g + 0.0722 * b));
const clip = ([r, g, b]: Rgb): Rgb => [unit(r), unit(g), unit(b)];
const unit = (v: number): number => Math.min(1, Math.max(0, v));
const ratio = (a: number, b: number): number => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

const linear = (color: string): Rgb => {
  const c = colorSyntax(color);
  if (c === null || c.alpha !== null)
    throw new RangeError(`contrast needs an opaque k.values color, got ${JSON.stringify(color).slice(0, 40)}`);
  return colorLinear(c);
};

/**
 * WCAG 2 contrast ratio of two opaque colors in any k.values form, 1..21, symmetric (k.values Contrast): each color's
 * luminance computed exactly from its form; the pair is judged as given, after CSS Color 4's gamut mapping to sRGB and
 * with each linear channel clipped to 0 to 1, the forms a screen may show, and the lowest ratio is returned. E1804 requires >= 4.5 (>= 3 at a large
 * size). Throws RangeError for any other value, a color with alpha among them.
 */
export function contrast(fg: string, bg: string): number {
  const a = linear(fg);
  const b = linear(bg);
  const given = ratio(luminance(a), luminance(b));
  const mapped = ratio(luminance(gamutMap(a)), luminance(gamutMap(b)));
  const clipped = ratio(luminance(clip(a)), luminance(clip(b)));
  return Math.min(given, mapped, clipped);
}
