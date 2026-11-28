import { inGamut } from "../internal/inGamut.ts";
import { linearToOklab } from "../internal/linearToOklab.ts";
import { oklabToLinear } from "../internal/oklabToLinear.ts";
import { p3ToSrgbLinear } from "../internal/p3ToSrgbLinear.ts";
import { srgbToP3Linear } from "../internal/srgbToP3Linear.ts";
import type { GamutForm } from "../types/GamutForm.ts";

type Rgb = readonly [number, number, number];

const JND = 0.02;
const EPSILON = 0.0001;

const clip = (c: Rgb): Rgb => [
  Math.min(1, Math.max(0, c[0])),
  Math.min(1, Math.max(0, c[1])),
  Math.min(1, Math.max(0, c[2])),
];
const same = (c: Rgb): Rgb => c;

/**
 * A linear sRGB color mapped into a gamut by CSS Color 4's gamut mapping (k.gamut Forms), as linear channels of that
 * gamut's space (linear sRGB, or linear display-p3): in OKLCH, a binary search on chroma at the color's lightness and
 * hue, keeping the clipped color once its distance from the search point is under the JND (0.02, epsilon 0.0001). A
 * color already in the gamut is returned in that space unmapped.
 */
export function gamutMap(color: Rgb, gamut: GamutForm): Rgb {
  const into = gamut === "sRGB" ? same : (c: Rgb): Rgb => srgbToP3Linear(...c);
  const back = gamut === "sRGB" ? same : (c: Rgb): Rgb => p3ToSrgbLinear(...c);
  const origin = into(color);
  if (inGamut(origin)) return origin;
  const [L, a, b] = linearToOklab(...color);
  if (L >= 1) return [1, 1, 1];
  if (L <= 0) return [0, 0, 0];
  const deltaEOK = (x: Rgb, y: Rgb): number => {
    const [l1, a1, b1] = linearToOklab(...back(x));
    const [l2, a2, b2] = linearToOklab(...back(y));
    return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
  };
  const C = Math.hypot(a, b);
  const h = Math.atan2(b, a);
  const at = (chroma: number): Rgb => into(oklabToLinear(L, chroma * Math.cos(h), chroma * Math.sin(h)));
  let current = origin;
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
