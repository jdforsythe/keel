import { colorSyntax } from "../internal/colorSyntax.ts";
import { hslToRgb } from "../internal/hslToRgb.ts";
import type { ColorSyntax } from "../types/ColorSyntax.ts";
import type { GamutForm } from "../types/GamutForm.ts";
import { colorLinear } from "./colorLinear.ts";
import { gamutMap } from "./gamutMap.ts";

type Rgb = readonly [number, number, number];

/** CSS Color 4's inverse sRGB transfer function, linear 0 to 1 to encoded 0 to 1. */
const encode = (c: number): number => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

const unit = (v: number): number => Math.min(1, Math.max(0, v));

/**
 * A color's encoded sRGB channels from 0 to 1, brought into the sRGB gamut first when it lies outside it: by CSS
 * Color 4's gamut mapping (`mapped`) or with each linear channel clipped to 0 to 1 (`clipped`).
 */
function encoded(c: ColorSyntax, form: GamutForm): Rgb {
  const [x, y, z] = c.channels;
  if (c.form === "hex" || c.form === "rgb") return [x / 255, y / 255, z / 255];
  if (c.form === "hsl") return hslToRgb(x, y, z);
  const lin = colorLinear(c);
  const [r, g, b] = form === "mapped" ? gamutMap(lin) : [unit(lin[0]), unit(lin[1]), unit(lin[2])];
  return [encode(r), encode(g), encode(b)];
}

/** A blended channel as browsers paint it: rounded to an integer from 0 to 255. */
const channel = (v: number): string => String(Math.round(unit(v) * 255));

/**
 * The opaque color an `<alpha>` shows over an opaque backdrop (k.values Contrast): `a × c + (1 - a) × b` on each
 * encoded sRGB channel, the overlay and the backdrop each brought into the sRGB gamut first in `form` (gamut mapped or
 * clipped), each channel rounded to an integer from 0 to 255, as browsers blend and paint. Contrast is judged on both
 * forms' composites, the lower ratio standing. The result is an `rgb()` value `contrast` takes. Throws RangeError when
 * `overlay` is not an `<alpha>` or `backdrop` not an opaque color.
 */
export function composite(overlay: string, backdrop: string, form: GamutForm): string {
  const o = colorSyntax(overlay);
  const b = colorSyntax(backdrop);
  if (o === null || o.alpha === null || b === null || b.alpha !== null)
    throw new RangeError(
      `composite needs an alpha color over an opaque one, got ${JSON.stringify([overlay, backdrop]).slice(0, 60)}`,
    );
  const a = o.alpha;
  const top = encoded(o, form);
  const under = encoded(b, form);
  const mix = top.map((c, i) => a * c + (1 - a) * (under[i] ?? 0));
  return `rgb(${mix.map(channel).join(" ")})`;
}
