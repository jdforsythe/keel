import { colorLinear } from "../css/colorLinear.ts";
import type { ColorSyntax } from "../types/ColorSyntax.ts";
import { inGamut } from "./inGamut.ts";

/** Whether a color lies outside sRGB (k.values Contrast), so it ships in two forms (k.gamut Forms). */
export function outsideSrgb(c: ColorSyntax): boolean {
  return !inGamut(colorLinear(c));
}
