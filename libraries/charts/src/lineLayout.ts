import { extent } from "./extent.ts";
import type { Frame } from "./Frame.ts";
import { fraction } from "./fraction.ts";

/**
 * One position per value, in order, across `frame`'s plot area: x spaced evenly from the left edge to the right (one
 * value sits in the middle), y from the lowest value at the bottom to the highest at the top (all equal: the middle).
 */
export function lineLayout(
  values: readonly number[],
  frame: Frame,
): readonly { readonly x: number; readonly y: number }[] {
  const { lo, hi } = extent(values, false);
  const plotW = frame.width - frame.left - frame.right;
  const plotH = frame.height - frame.top - frame.bottom;
  const step = values.length > 1 ? plotW / (values.length - 1) : 0;
  return values.map((v, i) => ({
    x: frame.left + (values.length > 1 ? i * step : plotW / 2),
    y: frame.top + (1 - fraction(lo, hi, v)) * plotH,
  }));
}
