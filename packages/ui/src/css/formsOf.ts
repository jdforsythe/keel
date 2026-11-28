import { colorSyntax } from "../internal/colorSyntax.ts";
import { outsideSrgb } from "../internal/outsideSrgb.ts";
import type { GamutForm } from "../types/GamutForm.ts";

const ONE: readonly GamutForm[] = ["sRGB"];
const BOTH: readonly GamutForm[] = ["sRGB", "P3"];

/**
 * The forms colors judged together ship in (k.gamut Judging): `sRGB` then `P3` when any of them lies outside sRGB,
 * else `sRGB` alone, since a color inside sRGB is its own P3 form. A value that is no k.values color is passed over.
 */
export function formsOf(...colors: readonly string[]): readonly GamutForm[] {
  return colors.some((v) => {
    const c = colorSyntax(v);
    return c !== null && outsideSrgb(c);
  })
    ? BOTH
    : ONE;
}
