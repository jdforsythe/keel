import { linearToOklab } from "../internal/linearToOklab.ts";
import { oklabToLinear } from "../internal/oklabToLinear.ts";

type Rgb = readonly [number, number, number];

const JND = 0.02;
const EPSILON = 0.0001;
/** How far past 0 or 1 a linear channel may sit and still be in the sRGB gamut (k.values Contrast). */
const SLACK = 0.000001;

const inGamut = (c: Rgb): boolean => c.every((x) => x >= -SLACK && x <= 1 + SLACK);
const clip = (c: Rgb): Rgb => [
  Math.min(1, Math.max(0, c[0])),
  Math.min(1, Math.max(0, c[1])),
  Math.min(1, Math.max(0, c[2])),
];
const deltaEOK = (a: Rgb, b: Rgb): number => {
  const [l1, a1, b1] = linearToOklab(...a);
  const [l2, a2, b2] = linearToOklab(...b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
};

/**
 * A linear sRGB color mapped into the sRGB gamut by CSS Color 4's gamut mapping: in OKLCH, a binary search on chroma
 * at the color's lightness and hue, keeping the clipped color once its distance from the search point is under the JND
 * (0.02, epsilon 0.0001). A color already in the gamut is returned as given.
 */
export function gamutMap(color: Rgb): Rgb {
  if (inGamut(color)) return color;
  const [L, a, b] = linearToOklab(...color);
  if (L >= 1) return [1, 1, 1];
  if (L <= 0) return [0, 0, 0];
  const C = Math.hypot(a, b);
  const h = Math.atan2(b, a);
  const at = (chroma: number): Rgb => oklabToLinear(L, chroma * Math.cos(h), chroma * Math.sin(h));
  let current = at(C);
  let clipped = clip(current);
  if (deltaEOK(clipped, current) < JND) return clipped;
  let min = 0;
  let max = C;
  let minInGamut = true;
  while (max - min > EPSILON) {
    const chroma = (min + max) / 2;
    current = at(chroma);
    if (minInGamut && inGamut(current)) {
      min = chroma;
      continue;
    }
    clipped = clip(current);
    const E = deltaEOK(clipped, current);
    if (E < JND) {
      if (JND - E < EPSILON) return clipped;
      minInGamut = false;
      min = chroma;
    } else max = chroma;
  }
  return clipped;
}
