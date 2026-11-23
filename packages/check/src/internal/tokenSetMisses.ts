import { STYLE_GROUPS } from "./STYLE_GROUPS.ts";

const isRec = (v: unknown): v is Readonly<Record<string, unknown>> => typeof v === "object" && v !== null;

/** Each token name or breakpoint `set` names that the tokens lack, with its `states`. */
function walk(
  tokens: Readonly<Record<string, unknown>>,
  set: unknown,
  label: string,
  out: { set: string; what: string }[],
): void {
  if (!isRec(set)) return;
  const has = (group: string, name: string): boolean => {
    const g = tokens[group];
    return isRec(g) && Object.hasOwn(g, name);
  };
  for (const [prop, v] of Object.entries(set)) {
    const groups = STYLE_GROUPS[prop];
    if (groups === undefined) continue;
    const values: readonly (readonly [string, unknown])[] =
      typeof v === "string" ? [["base", v]] : isRec(v) ? Object.entries(v) : [];
    for (const [bp, token] of values) {
      if (bp !== "base" && !has("breakpoint", bp))
        out.push({ set: label, what: `${prop} breakpoint "${bp}" is not a breakpoint token` });
      if (typeof token === "string" && !groups.some((g) => has(g, token)))
        out.push({ set: label, what: `${prop}="${token}" is not a ${groups[0] ?? ""} token` });
    }
  }
  const states = set.states;
  if (isRec(states)) for (const [name, st] of Object.entries(states)) walk(tokens, st, `${label}.states.${name}`, out);
}

/**
 * E1801 over the tokens artifact: a token name or breakpoint in a `base` set or a look that the tokens do not
 * declare, labelled by set (`base.button`, `look.primary.states.hover`). `base.focus` names a color token.
 */
export function tokenSetMisses(tokens: unknown): readonly { readonly set: string; readonly what: string }[] {
  if (!isRec(tokens)) return [];
  const out: { set: string; what: string }[] = [];
  const colors = tokens.color;
  const sets: readonly (readonly [string, unknown])[] = [
    ["base", tokens.base],
    ["look", tokens.look],
  ];
  for (const [group, named] of sets) {
    if (!isRec(named)) continue;
    for (const [name, set] of Object.entries(named)) {
      if (group === "base" && name === "focus") {
        if (typeof set === "string" && !(isRec(colors) && Object.hasOwn(colors, set)))
          out.push({ set: "base.focus", what: `"${set}" is not a color token` });
        continue;
      }
      walk(tokens, set, `${group}.${name}`, out);
    }
  }
  return out;
}
