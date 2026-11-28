/** Linear sRGB to Oklab `[L, a, b]`, by CSS Color 4's matrices through LMS. */
export function linearToOklab(r: number, g: number, b: number): readonly [number, number, number] {
  const l = Math.cbrt(0.4122214694707629 * r + 0.5363325372617349 * g + 0.0514459932675022 * b);
  const m = Math.cbrt(0.2119034958178251 * r + 0.6806995506452344 * g + 0.1073969535369405 * b);
  const s = Math.cbrt(0.0883024591900564 * r + 0.2817188391361215 * g + 0.6299787016738221 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
