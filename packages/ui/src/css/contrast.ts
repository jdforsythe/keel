import { colorForm } from "../internal/colorForm.ts";
import { colorSyntax } from "../internal/colorSyntax.ts";
import type { GamutForm } from "../types/GamutForm.ts";
import { colorLinear } from "./colorLinear.ts";
import { formsOf } from "./formsOf.ts";

type Rgb = readonly [number, number, number];

const luminance = ([r, g, b]: Rgb): number => Math.min(1, Math.max(0, 0.2126 * r + 0.7152 * g + 0.0722 * b));
const ratio = (a: number, b: number): number => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

const lum = (color: string, form: GamutForm): number => {
  const c = colorSyntax(color);
  if (c === null || c.alpha !== null)
    throw new RangeError(`contrast needs an opaque k.values color, got ${JSON.stringify(color).slice(0, 40)}`);
  const shipped = colorSyntax(colorForm(color, form));
  return luminance(colorLinear(shipped ?? c));
};

/**
 * WCAG 2 contrast ratio of two opaque colors in any k.values form, 1..21, symmetric (k.gamut Judging): each color's
 * luminance computed exactly from the form it ships in. With `form`, the pair is judged in that form; without, in each
 * form it ships in (`formsOf`), the lower ratio returned. E1804 requires >= 4.5 (>= 3 at a large size). Throws
 * RangeError for any other value, a color with alpha among them.
 */
export function contrast(fg: string, bg: string, form?: GamutForm): number {
  const forms = form === undefined ? formsOf(fg, bg) : [form];
  return Math.min(...forms.map((f) => ratio(lum(fg, f), lum(bg, f))));
}
