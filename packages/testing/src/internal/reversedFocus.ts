import type { Tokens } from "@keel/ui";
import { compileStyles } from "@keel/ui/css";
import type { Violation } from "./Violation.ts";
import { focusOrder } from "./focusOrder.ts";
import { px } from "./px.ts";
import { where } from "./where.ts";

const DIRECTIONS = ["row", "column", "row-reverse", "column-reverse"] as const;
type DirectionClasses = {
  /** Each resting `direction` class: whether it reverses, and its breakpoint's `min-width` (0 for the base). */
  readonly byClass: ReadonlyMap<string, { readonly reversed: boolean; readonly width: number }>;
  /** The base and each breakpoint's `min-width`, ascending. */
  readonly widths: readonly number[];
};
const memo = new WeakMap<Tokens, DirectionClasses>();

/** The resting `direction` classes `tokens` can produce, per breakpoint, through `compileStyles`. */
function directionClasses(tokens: Tokens): DirectionClasses {
  const hit = memo.get(tokens);
  if (hit !== undefined) return hit;
  const breakpoints = Object.entries(tokens.breakpoint ?? {}).map(([n, v]): readonly [string, number] => [n, px(v)]);
  const usages = DIRECTIONS.flatMap((direction) =>
    [undefined, ...breakpoints].map((bp) => ({
      reversed: direction.endsWith("-reverse"),
      width: bp?.[1] ?? 0,
      usage: bp === undefined ? { props: { direction } } : { props: { direction }, breakpoint: bp[0] },
    })),
  );
  const { classes } = compileStyles({ tokens, usages: usages.map((u) => u.usage) });
  const byClass = new Map<string, { reversed: boolean; width: number }>();
  usages.forEach(({ reversed, width }, i) => {
    const [cls] = classes[i] ?? [];
    if (cls !== undefined) byClass.set(cls, { reversed, width });
  });
  const out = { byClass, widths: [0, ...breakpoints.map(([, w]) => w)].sort((a, b) => a - b) };
  memo.set(tokens, out);
  return out;
}

/**
 * E1820 at render (k.a11y Order and focus): every element whose resting atomic classes give `direction`
 * `row-reverse` or `column-reverse` at the base or any breakpoint (the widest applicable class winning at each
 * width) over two or more elements of its sequential focus order (`focusOrder`). One violation per element.
 */
export function reversedFocus(root: Element, tokens: Tokens): Violation[] {
  const { byClass, widths } = directionClasses(tokens);
  const out: Violation[] = [];
  for (const el of [root, ...Array.from(root.querySelectorAll("*"))]) {
    const own = Array.from(el.classList).flatMap((c) => byClass.get(c) ?? []);
    if (!own.some((d) => d.reversed)) continue;
    const reversedAt = widths.some((w) => {
      const winning = own.filter((d) => d.width <= w).sort((a, b) => b.width - a.width)[0];
      return winning?.reversed === true;
    });
    if (!reversedAt || focusOrder(el).length < 2) continue;
    out.push({
      rule: "E1820",
      element: el.id,
      at: where(el),
      help: "reversed direction over two or more focusable elements: focus order differs from the visual order",
    });
  }
  return out;
}
