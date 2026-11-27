import { decodeChannel } from "../internal/decodeChannel.ts";
import { hslToRgb } from "../internal/hslToRgb.ts";
import { oklabToLinear } from "../internal/oklabToLinear.ts";
import { p3ToSrgbLinear } from "../internal/p3ToSrgbLinear.ts";
import type { ColorSyntax } from "../types/ColorSyntax.ts";

type Rgb = readonly [number, number, number];

/** WCAG 2's linearisation of an encoded sRGB channel from 0 to 1. */
const wcag = (c: number): number => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/**
 * A color's linear sRGB channels (k.values Contrast), unclamped, so a color outside the sRGB gamut has a channel below
 * 0 or above 1: hex and `rgb()` by WCAG 2's linearisation, `hsl()` through `hslToRgb` first, `oklab()` and `oklch()`
 * (hue in degrees) and `color(display-p3 ...)` through CSS Color 4's transfer function and matrices.
 */
export function colorLinear(c: ColorSyntax): Rgb {
  const [x, y, z] = c.channels;
  switch (c.form) {
    case "hex":
    case "rgb":
      return [wcag(x / 255), wcag(y / 255), wcag(z / 255)];
    case "hsl": {
      const [r, g, b] = hslToRgb(x, y, z);
      return [wcag(r), wcag(g), wcag(b)];
    }
    case "oklab":
      return oklabToLinear(x, y, z);
    case "oklch": {
      const rad = (z * Math.PI) / 180;
      return oklabToLinear(x, y * Math.cos(rad), y * Math.sin(rad));
    }
    case "p3":
      return p3ToSrgbLinear(decodeChannel(x), decodeChannel(y), decodeChannel(z));
  }
}
