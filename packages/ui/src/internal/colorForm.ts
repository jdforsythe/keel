import { colorLinear } from "../css/colorLinear.ts";
import { gamutMap } from "../css/gamutMap.ts";
import type { GamutForm } from "../types/GamutForm.ts";
import { colorSyntax } from "./colorSyntax.ts";
import { encodeChannel } from "./encodeChannel.ts";
import { outsideSrgb } from "./outsideSrgb.ts";

const unit = (v: number): number => Math.min(1, Math.max(0, v));
/** An encoded display-p3 channel rounded to 4 decimals, as the shortest `<n>` of that value (`1`, `0.5055`). */
const p3Channel = (v: number): string => String(Math.round(unit(v) * 10000) / 10000);

/**
 * A color in one of the forms it ships in (k.gamut Forms). A color inside sRGB is its own form in both. One outside
 * it: in `sRGB`, `rgb(<r> <g> <b>)` after CSS Color 4's gamut mapping into sRGB, each channel encoded, times 255 and
 * rounded; in `P3`, the color as written when it is a `color(display-p3 ...)`, else `color(display-p3 <u> <u> <u>)`
 * after the same mapping into display-p3, each channel encoded and rounded to 4 decimals. A ` / <a>` is kept as written.
 * Throws RangeError for a value that is no k.values color.
 */
export function colorForm(color: string, form: GamutForm): string {
  const c = colorSyntax(color);
  if (c === null) throw new RangeError(`not a k.values color: ${JSON.stringify(color).slice(0, 40)}`);
  if (!outsideSrgb(c)) return color;
  const slash = color.indexOf(" / ");
  const alpha = slash < 0 ? "" : color.slice(slash, -1);
  const lin = colorLinear(c);
  if (form === "sRGB")
    return `rgb(${gamutMap(lin, "sRGB")
      .map((x) => Math.round(unit(encodeChannel(x)) * 255))
      .join(" ")}${alpha})`;
  if (c.form === "p3") return color;
  return `color(display-p3 ${gamutMap(lin, "P3")
    .map((x) => p3Channel(encodeChannel(x)))
    .join(" ")}${alpha})`;
}
