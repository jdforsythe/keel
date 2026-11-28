/** An element's box in CSS pixels, or the document's (k.e2e-page `layout`). */
export type Layout = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly scrollWidth: number;
  readonly clientWidth: number;
};
