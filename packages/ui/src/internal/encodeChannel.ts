/** CSS Color 4's inverse sRGB transfer function, as display-p3 shares it: a linear channel to its encoded value, sign kept. */
export function encodeChannel(c: number): number {
  const a = Math.abs(c);
  return Math.sign(c) * (a <= 0.0031308 ? 12.92 * a : 1.055 * a ** (1 / 2.4) - 0.055);
}
