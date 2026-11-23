import type { PartState } from "../aria/PartState.ts";
import type { StyleProp } from "../types/StyleProp.ts";
import type { StyleSet } from "../types/StyleSet.ts";
import type { SetLeaf } from "./SetLeaf.ts";
import { states } from "./states.ts";
import { styleProps } from "./styleProps.ts";

type Values = Readonly<Partial<Record<StyleProp, string | Readonly<Record<string, string>>>>>;

const leaves = (v: Values, state: PartState | undefined, out: SetLeaf[]): void => {
  for (const prop of styleProps) {
    const x = v[prop];
    if (typeof x === "string") out.push({ prop, token: x, breakpoint: undefined, state });
    else if (x !== undefined)
      for (const [bp, token] of Object.entries(x))
        out.push({ prop, token, breakpoint: bp === "base" ? undefined : bp, state });
  }
};

/** The leaves of a `base` or `look` set: its plain props, then each state's in cascade order. */
export function setLeaves(set: StyleSet): SetLeaf[] {
  const out: SetLeaf[] = [];
  leaves(set, undefined, out);
  for (const s of states) {
    const nested = set.states?.[s.key];
    if (nested !== undefined) leaves(nested, s.key, out);
  }
  return out;
}
