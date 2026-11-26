import { composite, contrast } from "@keel/ui/css";
import type { Combo } from "./Combo.ts";
import { overOf } from "./overOf.ts";
import { valueIn } from "./valueIn.ts";

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const isRec = (v: unknown): v is Readonly<Record<string, unknown>> => typeof v === "object" && v !== null;

/** An opaque color for a name in a combination (a hex literal as is), or undefined. */
const opaque = (c: Combo, name: string): string | undefined => (HEX.test(name) ? name : valueIn(c, "color", name));

/** A length in `px`, `pt`, `rem` or `em` (16px to the `rem` and `em`) as pixels, or 0 for any other value. */
function lengthPixels(v: string): number {
  const m = /^(\d+(?:\.\d+)?)(px|pt|rem|em)$/.exec(v);
  if (m?.[1] === undefined) return 0;
  const n = Number(m[1]);
  return m[2] === "px" ? n : m[2] === "pt" ? (n * 4) / 3 : n * 16;
}

/** A `fontSize` token's pixel size at its smallest (k.values What check judges), 0 (normal text) when unknown. */
function pixels(tokens: unknown, name: string | undefined): number {
  const sizes = isRec(tokens) ? tokens.fontSize : undefined;
  const v = name !== undefined && isRec(sizes) ? sizes[name] : undefined;
  if (typeof v !== "string") return 0;
  const clamp = /^clamp\(([^,()]+), /.exec(v);
  return lengthPixels(clamp?.[1] ?? v);
}

/** A `weight` token's numeric weight, or 0 when unknown. */
function weightOf(tokens: unknown, name: string | undefined): number {
  const weights = isRec(tokens) ? tokens.weight : undefined;
  const v = name !== undefined && isRec(weights) ? weights[name] : undefined;
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : 0;
  return Number.isFinite(n) ? n : 0;
}

/** The ratio of a pair of values when every form reads, else undefined (a value check leaves to the render). */
const ratioOf = (fg: string, bg: string): number | undefined => {
  try {
    return contrast(fg, bg);
  } catch {
    return undefined;
  }
};
const over = (top: string, back: string): string | undefined => {
  try {
    return composite(top, back);
  } catch {
    return undefined;
  }
};

/**
 * The first combination where `fg` on `bg` falls below its threshold (k.a11y-static Judged, Combinations, Overlays),
 * as finding data (`fg`, `bg`, `scheme` the combination's name, `ratio`, `need`, and `over` for a `bg` overlay's
 * backdrop), or undefined. Text needs 4.5:1, 3:1 at a large size, and with the `contrast` theme on 7:1 and 4.5:1. A
 * `bg` overlay sits on `under` when the chain found it, else on each of its `over`; an `fg` overlay is composited over
 * the `bg` it sits on. `size` or `weight` `null` (unread) judges at the large size's need.
 */
export function failing(
  tokens: unknown,
  combos: readonly Combo[],
  fg: string,
  bg: string,
  size: string | null | undefined,
  weight: string | null | undefined,
  under?: string,
): Readonly<Record<string, string>> | undefined {
  const px = size === null || weight === null ? 24 : pixels(tokens, size);
  const large = px >= 24 || (px >= 18.66 && weightOf(tokens, weight ?? undefined) >= 700);
  for (const c of combos) {
    const min = c.contrast ? (large ? 4.5 : 7) : large ? 3 : 4.5;
    const bgOver = overOf(c, bg);
    const backs: (string | undefined)[] =
      bgOver === undefined ? [undefined] : under === undefined ? [...bgOver] : [under];
    for (const back of backs) {
      let b: string | undefined;
      if (bgOver === undefined) b = opaque(c, bg);
      else {
        const top = valueIn(c, "overlay", bg);
        const base = back === undefined ? undefined : opaque(c, back);
        b = top === undefined || base === undefined ? undefined : over(top, base);
      }
      if (b === undefined) continue;
      const fgTop = overOf(c, fg) === undefined ? opaque(c, fg) : valueIn(c, "overlay", fg);
      const a = fgTop === undefined ? undefined : overOf(c, fg) === undefined ? fgTop : over(fgTop, b);
      if (a === undefined) continue;
      const ratio = ratioOf(a, b);
      if (ratio !== undefined && ratio < min)
        return {
          fg,
          bg,
          scheme: c.name,
          ratio: ratio.toFixed(2),
          need: String(min),
          ...(bgOver === undefined || back === undefined ? {} : { over: back }),
        };
    }
  }
  return undefined;
}
