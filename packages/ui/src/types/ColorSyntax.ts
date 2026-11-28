/** A color as k.values Colors writes it: its form, its three channels as numbers, and its alpha (null when opaque). */
export type ColorSyntax = {
  readonly form: "hex" | "rgb" | "hsl" | "oklab" | "oklch" | "p3";
  /** hex and `rgb()`: 0 to 255; `hsl()`: hue in degrees, then percents; `oklab()`: L 0 to 1, a, b; `oklch()`: L, C, hue in degrees; display-p3: 0 to 1. */
  readonly channels: readonly [number, number, number];
  readonly alpha: number | null;
};
