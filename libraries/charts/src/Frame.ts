/** A drawing's box in SVG user units: the `viewBox` width and height, and the plot area inside its margins. */
export type Frame = {
  readonly width: number;
  readonly height: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
};
