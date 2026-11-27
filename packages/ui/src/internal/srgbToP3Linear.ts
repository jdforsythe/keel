type Rgb = readonly [number, number, number];

/** Linear sRGB to linear display-p3: CSS Color 4's sRGB to XYZ (D65) and XYZ to display-p3 matrices, multiplied. */
export function srgbToP3Linear(r: number, g: number, b: number): Rgb {
  const x = 0.41239079926595934 * r + 0.357584339383878 * g + 0.1804807884018343 * b;
  const y = 0.21263900587151027 * r + 0.715168678767756 * g + 0.07219231536073371 * b;
  const z = 0.01933081871559182 * r + 0.11919477979462598 * g + 0.9505321522496607 * b;
  return [
    2.4934969119414254 * x - 0.9313836179191239 * y - 0.40271078445071684 * z,
    -0.8294889695615747 * x + 1.7626640603183463 * y + 0.023624685841943577 * z,
    0.03584583024378447 * x - 0.07617238926804182 * y + 0.9568845240076872 * z,
  ];
}
