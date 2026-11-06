import { className } from "../internal/className.ts";
import { states } from "../internal/states.ts";
import { styleProps } from "../internal/styleProps.ts";
import { tokenGroups } from "../internal/tokenGroups.ts";
import { varName } from "../internal/varName.ts";
import { vocabulary } from "../internal/vocabulary.ts";
import type { StyleState } from "../types/StyleState.ts";
import type { StyleUsage } from "../types/StyleUsage.ts";
import type { Tokens } from "../types/Tokens.ts";

type Rule = {
  readonly cls: string;
  readonly order: readonly number[];
  readonly breakpoint: string | undefined;
  readonly state: StyleState | undefined;
  readonly body: string;
};

const fail = (code: string, message: string): Error => Object.assign(new Error(message), { code });

/** Token values are written into declarations; anything that could end one is rejected. */
const value = (group: string, name: string, v: string): string => {
  if (/[{};<>]|\/\*/.test(v)) throw fail("E1807", `token ${group}.${name} has a value that breaks out of CSS`);
  return v;
};

const compare = (a: Rule, b: Rule): number => {
  for (let i = 0; i < a.order.length; i++) {
    const d = (a.order[i] ?? 0) - (b.order[i] ?? 0);
    if (d !== 0) return d;
  }
  return a.cls < b.cls ? -1 : a.cls > b.cls ? 1 : 0;
};

/** The declaration block for `prop` = `token`, and the token's index in its group (for ordering). */
function resolve(tokens: Tokens, prop: keyof typeof vocabulary, token: string): { body: string; index: number } {
  const entry = vocabulary[prop];
  const kw = Object.keys(entry.keywords);
  const k = kw.indexOf(token);
  if (k >= 0) return { body: `display:flex;${entry.property}:${entry.keywords[token]}`, index: k };
  for (const group of entry.groups) {
    const names = Object.keys(tokens[group] ?? {});
    const i = names.indexOf(token);
    if (i >= 0) return { body: `${entry.property}:var(${varName(group, token)})`, index: i };
  }
  const want = entry.groups.length > 0 ? `a ${entry.groups.join(" or ")} token` : `one of ${kw.join(" ")}`;
  throw fail("E1801", `${prop}=${JSON.stringify(token).slice(0, 40)} is not ${want}`);
}

function rootBlocks(tokens: Tokens): string[] {
  const light: string[] = [];
  const dark: string[] = [];
  const reduced: string[] = [];
  for (const group of tokenGroups) {
    if (group === "breakpoint") continue;
    for (const [name, v] of Object.entries(tokens[group] ?? {})) {
      const n = varName(group, name);
      if (typeof v === "string") light.push(`${n}:${value(group, name, v)}`);
      else {
        light.push(`${n}:${value(group, name, v.light)}`);
        dark.push(`${n}:${value(group, name, v.dark)}`);
      }
      if (group === "motion") reduced.push(`${n}:0ms`);
    }
  }
  const out: string[] = [];
  if (light.length > 0) out.push(`:root{${light.join(";")}}`);
  if (dark.length > 0) out.push(`@media (prefers-color-scheme: dark){\n:root{${dark.join(";")}}\n}`);
  if (reduced.length > 0) out.push(`@media (prefers-reduced-motion: reduce){\n:root{${reduced.join(";")}}\n}`);
  return out;
}

const ruleText = (r: Rule): string => `.${r.cls}${states.find((s) => s.key === r.state)?.pseudo ?? ""}{${r.body}}`;

/**
 * Compile style usages to atomic CSS. Pure and deterministic: one class per (prop, token, breakpoint,
 * state), deduplicated; equal props give equal class lists. Output order: `:root` custom properties
 * (dark-scheme and reduced-motion overrides in media blocks), base rules, one `min-width` block per
 * breakpoint in token order, then state rules (hover, focusVisible, active, disabled) and their
 * breakpoint blocks. Throws `code: 'E1801'` for an unknown token or breakpoint, `E1807` for an unsafe value.
 */
export function compileStyles(input: { readonly tokens: Tokens; readonly usages: readonly StyleUsage[] }): {
  classes: string[][];
  css: string;
} {
  const { tokens } = input;
  const bps = Object.entries(tokens.breakpoint ?? {});
  const rules = new Map<string, Rule>();
  const classes = input.usages.map((u) => {
    const bpIndex = u.breakpoint === undefined ? -1 : bps.findIndex(([n]) => n === u.breakpoint);
    if (bpIndex < 0 && u.breakpoint !== undefined)
      throw fail("E1801", `breakpoint ${JSON.stringify(u.breakpoint).slice(0, 40)} is not a breakpoint token`);
    const stateIndex = states.findIndex((s) => s.key === u.state);
    const out: string[] = [];
    for (const [p, prop] of styleProps.entries()) {
      const token = u.props[prop];
      if (token === undefined) continue;
      const cls = className(prop, token, u.breakpoint, u.state);
      if (!rules.has(cls)) {
        const { body, index } = resolve(tokens, prop, token);
        rules.set(cls, {
          cls,
          order: [stateIndex, p, index],
          breakpoint: u.breakpoint,
          state: u.state,
          body,
        });
      }
      out.push(cls);
    }
    return out;
  });
  const sorted = [...rules.values()].sort(compare);
  const section = (stateful: boolean): string[] => {
    const own = sorted.filter((r) => (r.state !== undefined) === stateful);
    const out = own.filter((r) => r.breakpoint === undefined).map(ruleText);
    for (const [name, width] of bps) {
      const inBp = own.filter((r) => r.breakpoint === name);
      if (inBp.length > 0)
        out.push(`@media (min-width: ${value("breakpoint", name, width)}){\n${inBp.map(ruleText).join("\n")}\n}`);
    }
    return out;
  };
  const css = [...rootBlocks(tokens), ...section(false), ...section(true)].join("\n");
  return { classes, css: css === "" ? "" : `${css}\n` };
}
