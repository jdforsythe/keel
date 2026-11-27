import { colorSyntax } from "../internal/colorSyntax.ts";
import { hslToRgb } from "../internal/hslToRgb.ts";
import type { ColorSyntax } from "../types/ColorSyntax.ts";
import { colorLinear } from "./colorLinear.ts";
import { gamutMap } from "./gamutMap.ts";

type Rgb = readonly [number, number, number];

/** CSS Color 4's inverse sRGB transfer function, linear 0 to 1 to encoded 0 to 1. */
const encode = (c: number): number => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** A color's encoded sRGB channels from 0 to 1, mapped into the sRGB gamut first when it lies outside it. */
function encoded(c: ColorSyntax): Rgb {
  const [x, y, z] = c.channels;
  if (c.form === "hex" || c.form === "rgb") return [x / 255, y / 255, z / 255];
  if (c.form === "hsl") return hslToRgb(x, y, z);
  const [r, g, b] = gamutMap(colorLinear(c));
  return [encode(r), encode(g), encode(b)];
}

/** A blended channel as browsers paint it: rounded to an integer from 0 to 255. */
const channel = (v: number): string => String(Math.round(Math.min(1, Math.max(0, v)) * 255));

/**
 * The opaque color an `<alpha>` shows over an opaque backdrop (k.values Contrast): `a × c + (1 - a) × b` on each
 * encoded sRGB channel, the overlay and the backdrop each mapped into the sRGB gamut first, each channel rounded to an
 * integer from 0 to 255, as browsers blend and paint. The
 * result is an `rgb()` value `contrast` takes. Throws RangeError when `overlay` is not an `<alpha>` or `backdrop` not an
 * opaque color.
 */
export function composite(overlay: string, backdrop: string): string {
  const o = colorSyntax(overlay);
  const b = colorSyntax(backdrop);
  if (o === null || o.alpha === null || b === null || b.alpha !== null)
    throw new RangeError(
      `composite needs an alpha color over an opaque one, got ${JSON.stringify([overlay, backdrop]).slice(0, 60)}`,
    );
  const a = o.alpha;
  const top = encoded(o);
  const under = encoded(b);
  const mix = top.map((c, i) => a * c + (1 - a) * (under[i] ?? 0));
  return `rgb(${mix.map(channel).join(" ")})`;
}
