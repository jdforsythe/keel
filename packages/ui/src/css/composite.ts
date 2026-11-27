import { colorForm } from "../internal/colorForm.ts";
import { colorSyntax } from "../internal/colorSyntax.ts";
import { encodeChannel } from "../internal/encodeChannel.ts";
import { hslToRgb } from "../internal/hslToRgb.ts";
import { srgbToP3Linear } from "../internal/srgbToP3Linear.ts";
import type { ColorSyntax } from "../types/ColorSyntax.ts";
import type { GamutForm } from "../types/GamutForm.ts";
import { colorLinear } from "./colorLinear.ts";

type Rgb = readonly [number, number, number];

const unit = (v: number): number => Math.min(1, Math.max(0, v));

/** A color's encoded channels from 0 to 1 in its form's space: sRGB, or display-p3. */
function encoded(color: string, form: GamutForm): Rgb {
  const c: ColorSyntax | null = colorSyntax(colorForm(color, form));
  if (c === null) return [0, 0, 0];
  const [x, y, z] = c.channels;
  if (form === "P3") {
    if (c.form === "p3") return [x, y, z];
    const [r, g, b] = srgbToP3Linear(...colorLinear(c));
    return [encodeChannel(r), encodeChannel(g), encodeChannel(b)];
  }
  if (c.form === "hex" || c.form === "rgb") return [x / 255, y / 255, z / 255];
  if (c.form === "hsl") return hslToRgb(x, y, z);
  const [r, g, b] = colorLinear(c);
  return [encodeChannel(r), encodeChannel(g), encodeChannel(b)];
}

/**
 * The opaque color an `<alpha>` shows over an opaque backdrop within one form (k.gamut Judging): `a × c + (1 - a) × b`
 * on each encoded channel of the two colors' forms, sRGB or display-p3, times 255 rounded to an integer, as browsers
 * blend and paint. The result, `rgb(<r> <g> <b>)` in `sRGB` and `color(display-p3 ...)` of those 255ths in `P3`, is a
 * value `contrast` takes in that form. Throws RangeError when `overlay` is not an `<alpha>` or `backdrop` not an opaque
 * color.
 */
export function composite(overlay: string, backdrop: string, form: GamutForm): string {
  const o = colorSyntax(overlay);
  const b = colorSyntax(backdrop);
  if (o === null || o.alpha === null || b === null || b.alpha !== null)
    throw new RangeError(
      `composite needs an alpha color over an opaque one, got ${JSON.stringify([overlay, backdrop]).slice(0, 60)}`,
    );
  const a = o.alpha;
  const top = encoded(overlay, form);
  const under = encoded(backdrop, form);
  const mix = top.map((c, i) => Math.round(unit(a * c + (1 - a) * (under[i] ?? 0)) * 255));
  return form === "sRGB" ? `rgb(${mix.join(" ")})` : `color(display-p3 ${mix.map((v) => v / 255).join(" ")})`;
}
