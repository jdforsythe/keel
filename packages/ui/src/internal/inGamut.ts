/** How far past 0 or 1 a linear channel may sit and still be in a gamut (k.values Contrast). */
const SLACK = 0.000001;

/** Whether each linear channel of a color is from 0 to 1 within 0.000001, so the color is inside that gamut. */
export function inGamut(c: readonly [number, number, number]): boolean {
  return c.every((x) => x >= -SLACK && x <= 1 + SLACK);
}
