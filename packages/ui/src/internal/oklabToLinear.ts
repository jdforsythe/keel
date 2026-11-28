type Rgb = readonly [number, number, number];

/** Oklab to linear sRGB, by CSS Color 4's matrices through LMS. */
export function oklabToLinear(L: number, a: number, b: number): Rgb {
  const l = (L + 0.3963377773761749 * a + 0.2158037573099136 * b) ** 3;
  const m = (L - 0.1055613458156586 * a - 0.0638541728258133 * b) ** 3;
  const s = (L - 0.0894841775298119 * a - 1.2914855480194092 * b) ** 3;
  return [
    4.076741636075958 * l - 3.307711539258063 * m + 0.2309699031821043 * s,
    -1.2684379732850315 * l + 2.609757349287688 * m - 0.341319376002657 * s,
    -0.0041960761386756 * l - 0.7034186179359363 * m + 1.7076146940746117 * s,
  ];
}
