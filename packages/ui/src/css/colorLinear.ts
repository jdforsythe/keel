import type { ColorSyntax } from "../internal/colorSyntax.ts";
import { hslToRgb } from "../internal/hslToRgb.ts";
import { oklabToLinear } from "../internal/oklabToLinear.ts";

type Rgb = readonly [number, number, number];

/** WCAG 2's linearisation of an encoded sRGB channel from 0 to 1. */
const wcag = (c: number): number => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
/** CSS Color 4's sRGB transfer function, sign kept, as display-p3 uses it. */
const css4 = (c: number): number => {
  const a = Math.abs(c);
  return Math.sign(c) * (a <= 0.04045 ? a / 12.92 : ((a + 0.055) / 1.055) ** 2.4);
};

/** Linear display-p3 to linear sRGB: CSS Color 4's display-p3 to XYZ (D65) and XYZ to sRGB matrices, multiplied. */
function p3ToLinear(r: number, g: number, b: number): Rgb {
  const x = 0.4865709486482162 * r + 0.26566769316909306 * g + 0.1982172852343625 * b;
  const y = 0.2289745640697488 * r + 0.6917385218365064 * g + 0.079286914093745 * b;
  const z = 0.04511338185890264 * g + 1.043944368900976 * b;
  return [
    3.2409699419045226 * x - 1.537383177570094 * y - 0.4986107602930034 * z,
    -0.9692436362808796 * x + 1.8759675015077202 * y + 0.04155505740717559 * z,
    0.05563007969699366 * x - 0.20397695888897652 * y + 1.0569715142428786 * z,
  ];
}

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
      return p3ToLinear(css4(x), css4(y), css4(z));
  }
}
