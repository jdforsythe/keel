type Rgb = readonly [number, number, number];

/** Linear display-p3 to linear sRGB: CSS Color 4's display-p3 to XYZ (D65) and XYZ to sRGB matrices, multiplied. */
export function p3ToSrgbLinear(r: number, g: number, b: number): Rgb {
  const x = 0.4865709486482162 * r + 0.26566769316909306 * g + 0.1982172852343625 * b;
  const y = 0.2289745640697488 * r + 0.6917385218365064 * g + 0.079286914093745 * b;
  const z = 0.04511338185890264 * g + 1.043944368900976 * b;
  return [
    3.2409699419045226 * x - 1.537383177570094 * y - 0.4986107602930034 * z,
    -0.9692436362808796 * x + 1.8759675015077202 * y + 0.04155505740717559 * z,
    0.05563007969699366 * x - 0.20397695888897652 * y + 1.0569715142428786 * z,
  ];
}
