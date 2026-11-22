import { missingAt } from "./missingAt.ts";
import { setKeys } from "./setKeys.ts";

const isRec = (v: unknown): v is Readonly<Record<string, unknown>> => typeof v === "object" && v !== null;

/** Each set's label and `gap` key with no `direction` covering it, its `states` checked with the set's direction. */
function walk(
  set: unknown,
  label: string,
  inherited: readonly (readonly string[] | null)[],
  order: readonly string[],
  out: { set: string; at: string }[],
): void {
  if (!isRec(set)) return;
  const dir = setKeys(set.direction);
  const dirs = dir === undefined ? inherited : [...inherited, dir];
  const gap = setKeys(set.gap);
  const at = gap === undefined || gap === null ? undefined : missingAt(gap, dirs, order);
  if (at !== undefined) out.push({ set: label, at });
  const states = set.states;
  if (isRec(states))
    for (const [name, st] of Object.entries(states)) walk(st, `${label}.states.${name}`, dirs, order, out);
}

/**
 * E1809 over the tokens artifact: every `base` set (`base.focus` is a color, not a set) and every look whose `gap`
 * has no `direction` at or below its smallest breakpoint, labelled `base.page`, `look.stack.states.hover`.
 */
export function tokenSetGaps(tokens: unknown): readonly { readonly set: string; readonly at: string }[] {
  if (!isRec(tokens)) return [];
  const order = isRec(tokens.breakpoint) ? Object.keys(tokens.breakpoint) : [];
  const out: { set: string; at: string }[] = [];
  const groups: readonly (readonly [string, unknown])[] = [
    ["base", tokens.base],
    ["look", tokens.look],
  ];
  for (const [group, sets] of groups) {
    if (!isRec(sets)) continue;
    for (const [name, set] of Object.entries(sets))
      if (name !== "focus" || group === "look") walk(set, `${group}.${name}`, [], order, out);
  }
  return out;
}
