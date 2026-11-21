import type { Tokens } from "@keel/ui";
import { compileStyles } from "@keel/ui/css";
import type { ClassMap } from "./ClassMap.ts";
import { px } from "./px.ts";

const PROPS = { fg: "color", bg: "color", fontSize: "fontSize", weight: "weight" } as const;
const memo = new WeakMap<Tokens, ClassMap>();

/**
 * Every resting atomic class (no state) of `fg`, `bg`, `fontSize` and `weight` that `tokens` can produce, per
 * breakpoint, mapped back to its prop and token through `compileStyles`, the compiler's own class names.
 */
export function styleIndex(tokens: Tokens): ClassMap {
  const hit = memo.get(tokens);
  if (hit !== undefined) return hit;
  const breakpoints = Object.entries(tokens.breakpoint ?? {}).map(([n, v]): readonly [string, number] => [n, px(v)]);
  const usages = Object.entries(PROPS).flatMap(([prop, group]) =>
    Object.keys(tokens[group] ?? {}).flatMap((token) =>
      [undefined, ...breakpoints.map(([n]) => n)].map((bp) => ({
        prop,
        token,
        bp,
        usage: bp === undefined ? { props: { [prop]: token } } : { props: { [prop]: token }, breakpoint: bp },
      })),
    ),
  );
  const { classes } = compileStyles({ tokens, usages: usages.map((u) => u.usage) });
  const byClass = new Map<string, { prop: string; token: string; bp: string | undefined }>();
  usages.forEach(({ prop, token, bp }, i) => {
    const [cls] = classes[i] ?? [];
    if (cls !== undefined) byClass.set(cls, { prop, token, bp });
  });
  const map = { byClass, breakpoints };
  memo.set(tokens, map);
  return map;
}
