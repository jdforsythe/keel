import { extent } from "./extent.ts";
import type { Frame } from "./Frame.ts";
import { fraction } from "./fraction.ts";

/**
 * One rectangle per value, in order, inside `frame`'s plot area: bars rise from the zero line, which sits between the
 * lowest and highest value (both widened to take in 0), so a negative value hangs below it. `base` is the zero line's y.
 */
export function barLayout(
  values: readonly number[],
  frame: Frame,
): {
  readonly base: number;
  readonly bars: readonly { readonly x: number; readonly y: number; readonly width: number; readonly height: number }[];
} {
  const { lo, hi } = extent(values, true);
  const plotW = frame.width - frame.left - frame.right;
  const plotH = frame.height - frame.top - frame.bottom;
  const yOf = (v: number) => frame.top + (1 - fraction(lo, hi, v)) * plotH;
  const base = lo === hi ? frame.top + plotH : yOf(0);
  const slot = values.length === 0 ? plotW : plotW / values.length;
  const width = slot * 0.7;
  const bars = values.map((v, i) => {
    const y = lo === hi ? base : yOf(v);
    return { x: frame.left + i * slot + (slot - width) / 2, y: Math.min(y, base), width, height: Math.abs(base - y) };
  });
  return { base, bars };
}
