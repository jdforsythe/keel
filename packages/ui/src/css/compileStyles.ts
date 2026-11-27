import type { StyleUsage } from "@keel/compiler";
import type { PartState } from "../aria/PartState.ts";
import type { SetLeaf } from "../internal/SetLeaf.ts";
import { baseRoles } from "../internal/baseRoles.ts";
import { className } from "../internal/className.ts";
import { focusProblem } from "../internal/focusProblem.ts";
import { setLeaves } from "../internal/setLeaves.ts";
import { states } from "../internal/states.ts";
import { styleProps } from "../internal/styleProps.ts";
import { tokenGroups } from "../internal/tokenGroups.ts";
import { valueForms } from "../internal/valueForms.ts";
import { varName } from "../internal/varName.ts";
import { vocabulary } from "../internal/vocabulary.ts";
import type { StyleProp } from "../types/StyleProp.ts";
import type { Tokens } from "../types/Tokens.ts";
import { schemesOf } from "./schemesOf.ts";
import { stateSelectors } from "./stateSelectors.ts";

type Rule = {
  readonly cls: string;
  readonly order: readonly number[];
  readonly breakpoint: string | undefined;
  readonly state: PartState | undefined;
  readonly body: string;
};

const HIDDEN = "[hidden]{display:none!important}";
const SUMMARY_LIST = ".k-summary ul{list-style:none;margin:0;padding:0}";
/** A table sizes its columns by min-content: under `anywhere` every word could break, so cells break only an overlong word. */
const TABLE_WRAP = "table{overflow-wrap:break-word}";
/** A header aligns as the cells of its row; a scroll region scrolls and shrinks inside a flex row. */
const TABLE_HEAD = "th{text-align:inherit}";
const SCROLL = ".k-scroll{overflow-x:auto;min-width:0}";

const fail = (code: string, message: string): Error => Object.assign(new Error(message), { code });

/** Token values are written into declarations; `valueForms` admitted each, so this only asserts none ends one. */
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
  if (k >= 0) return { body: `${entry.lead}${entry.property}:${entry.keywords[token]}`, index: k };
  for (const group of entry.groups) {
    const names = Object.keys(tokens[group] ?? {});
    const i = names.indexOf(token);
    if (i >= 0) return { body: `${entry.lead}${entry.property}:var(${varName(group, token)})`, index: i };
  }
  const want = entry.groups.length > 0 ? `a ${entry.groups.join(" or ")} token` : `one of ${kw.join(" ")}`;
  throw fail("E1801", `${prop}=${JSON.stringify(token).slice(0, 40)} is not ${want}`);
}

/**
 * The custom properties (k.schemes CSS): with one scheme, `:root` declares `color-scheme` and that scheme's values;
 * with both, `:root` holds the light values, the dark ones follow the system preference until `data-k-scheme` on
 * `<html>` overrides it.
 */
function rootBlocks(tokens: Tokens): string[] {
  const schemes = schemesOf(tokens);
  const both = schemes.length === 2;
  const first = schemes[0] ?? "light";
  const main: string[] = [];
  const dark: string[] = [];
  const reduced: string[] = [];
  for (const group of tokenGroups) {
    if (group === "breakpoint") continue;
    for (const [name, v] of Object.entries(tokens[group] ?? {})) {
      const n = varName(group, name);
      if (typeof v === "string") main.push(`${n}:${value(group, name, v)}`);
      else {
        main.push(`${n}:${value(group, name, both ? v.light : v[first])}`);
        if (both) dark.push(`${n}:${value(group, name, v.dark)}`);
      }
      if (group === "motion") reduced.push(`${n}:0ms`);
    }
  }
  const out = [`:root{${[`color-scheme:${both ? "light dark" : first}`, ...main].join(";")}}`];
  if (both) {
    const d = dark.join(";");
    out.push(`@media (prefers-color-scheme: dark){\n:root:not([data-k-scheme="light"]){${d}}\n}`);
    out.push(`:root[data-k-scheme="dark"]{${["color-scheme:dark", ...dark].join(";")}}`);
    out.push(`:root[data-k-scheme="light"]{color-scheme:light}`);
  }
  if (reduced.length > 0) out.push(`@media (prefers-reduced-motion: reduce){\n:root{${reduced.join(";")}}\n}`);
  return out;
}

const selectorsOf = (sel: string, state: PartState | undefined): string =>
  (state === undefined ? [""] : stateSelectors(state)).map((s) => `${sel}${s}`).join(",");

const ruleText = (r: Rule): string => `${selectorsOf(`.${r.cls}`, r.state)}{${r.body}}`;

/** The style prop `k` names, or `undefined`. */
const stylePropOf = (k: string): StyleProp | undefined => styleProps.find((p) => p === k);

/** The `keel.base` layer (k.ui Base): fixed rules, each `base` set on its role, and the `base.focus` ring. */
function baseLayer(tokens: Tokens, bps: readonly (readonly [string, string])[]): string {
  const rules: string[] = [HIDDEN, TABLE_WRAP, TABLE_HEAD, SCROLL];
  const media = new Map<string, string[]>();
  const decls = (ls: readonly SetLeaf[]): string => ls.map((l) => resolve(tokens, l.prop, l.token).body).join(";");
  for (const { role, selector } of baseRoles) {
    const set = tokens.base?.[role];
    const leaves = set === undefined ? [] : setLeaves(set);
    for (const l of leaves)
      if (l.breakpoint !== undefined && !bps.some(([n]) => n === l.breakpoint))
        throw fail(
          "E1801",
          `base.${role} breakpoint ${JSON.stringify(l.breakpoint).slice(0, 40)} is not a breakpoint token`,
        );
    const groups = [undefined, ...states.map((s) => s.key)].flatMap((state) =>
      [undefined, ...bps.map(([n]) => n)].map((bp) => ({
        state,
        bp,
        leaves: leaves.filter((l) => l.state === state && l.breakpoint === bp),
      })),
    );
    for (const g of groups) {
      const own = decls(g.leaves);
      const body =
        role === "page" && g.state === undefined && g.bp === undefined ? ["overflow-wrap:anywhere", own] : [own];
      const text = body.filter((d) => d !== "").join(";");
      if (text === "") continue;
      const rule = `${selectorsOf(selector, g.state)}{${text}}`;
      if (g.bp === undefined) rules.push(rule);
      else media.set(g.bp, [...(media.get(g.bp) ?? []), rule]);
    }
    if (role === "summary") rules.push(SUMMARY_LIST);
  }
  const focus = tokens.base?.focus;
  if (focus !== undefined) {
    if (tokens.color?.[focus] === undefined)
      throw fail("E1801", `base.focus=${JSON.stringify(focus).slice(0, 40)} is not a color token`);
    rules.push(`:focus-visible{outline:2px solid var(${varName("color", focus)});outline-offset:2px}`);
  }
  for (const [name, width] of bps) {
    const inBp = media.get(name);
    if (inBp !== undefined)
      rules.push(`@media (min-width: ${value("breakpoint", name, width)}){\n${inBp.join("\n")}\n}`);
  }
  return `@layer keel.base{\n${rules.join("\n")}\n}`;
}

/**
 * Compile style usages to atomic CSS. Pure and deterministic: one class per (prop, token, breakpoint,
 * state), deduplicated; equal props give equal class lists. A usage naming a `look` gets the set's classes for every
 * prop and state it does not set itself, then its own. Output order: `:root` custom properties (the k.schemes rules and
 * reduced-motion overrides in a media block), the `keel.base` layer (`[hidden]{display:none!important}`, `body` with
 * `overflow-wrap:anywhere`, the summary's list unmarked, each `base` set on its role selector with its states and
 * breakpoints, and the `base.focus` ring on `:focus-visible`), then the unlayered atomic rules: base rules, one
 * `min-width` block per breakpoint in token order, then state rules (selected, checked, expanded, highlighted, hover,
 * focusVisible, active, disabled) and their breakpoint blocks. Throws `code: 'E1801'` for an unknown token,
 * breakpoint or look, `E1807` for an unsafe value or a `base.focus` under 3:1 against `base.page`'s `bg`.
 */
export function compileStyles(input: { readonly tokens: Tokens; readonly usages: readonly StyleUsage[] }): {
  classes: string[][];
  css: string;
} {
  const { tokens } = input;
  const refused = valueForms(tokens)[0];
  if (refused !== undefined) throw fail("E1807", `token ${refused.join(".")} is not in its group's form`);
  const problem = focusProblem(tokens);
  if (problem !== null) throw fail("E1807", problem);
  const bps = Object.entries(tokens.breakpoint ?? {});
  const rules = new Map<string, Rule>();
  const add = (
    prop: StyleProp,
    token: string,
    breakpoint: string | undefined,
    state: PartState | undefined,
  ): string => {
    const bpIndex = breakpoint === undefined ? -1 : bps.findIndex(([n]) => n === breakpoint);
    if (bpIndex < 0 && breakpoint !== undefined)
      throw fail("E1801", `breakpoint ${JSON.stringify(breakpoint).slice(0, 40)} is not a breakpoint token`);
    const cls = className(prop, token, breakpoint, state);
    if (!rules.has(cls)) {
      const { body, index } = resolve(tokens, prop, token);
      const stateIndex = states.findIndex((s) => s.key === state);
      rules.set(cls, { cls, order: [stateIndex, styleProps.indexOf(prop), index], breakpoint, state, body });
    }
    return cls;
  };
  const looks = new Map<string, SetLeaf[]>();
  for (const [name, set] of Object.entries(tokens.look ?? {})) {
    const leaves = setLeaves(set);
    // Every look's tokens resolve, used or not: a bad name in tokens.ts is E1801 where it is written.
    for (const l of leaves) {
      resolve(tokens, l.prop, l.token);
      if (l.breakpoint !== undefined && !bps.some(([n]) => n === l.breakpoint))
        throw fail(
          "E1801",
          `look.${name} breakpoint ${JSON.stringify(l.breakpoint).slice(0, 40)} is not a breakpoint token`,
        );
    }
    looks.set(name, leaves);
  }
  const classes = input.usages.map((u) => {
    const out: string[] = [];
    for (const prop of styleProps) {
      const token = u.props[prop];
      if (token !== undefined) out.push(add(prop, token, u.breakpoint, u.state));
    }
    if (u.look === undefined) return out;
    const set = looks.get(u.look);
    if (set === undefined) throw fail("E1801", `look=${JSON.stringify(u.look).slice(0, 40)} is not a look token`);
    const own = new Set(
      Object.keys(u.props).flatMap((k) => {
        const p = stylePropOf(k);
        return p === undefined ? [] : [`${u.state ?? ""}:${p}`];
      }),
    );
    const fromLook = set
      .filter((l) => !own.has(`${l.state ?? ""}:${l.prop}`))
      .map((l) => add(l.prop, l.token, l.breakpoint, l.state));
    return [...fromLook, ...out];
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
  const css = [...rootBlocks(tokens), baseLayer(tokens, bps), ...section(false), ...section(true)].join("\n");
  return { classes, css: `${css}\n` };
}
