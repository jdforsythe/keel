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
import { valueInForm } from "../internal/valueInForm.ts";
import { varName } from "../internal/varName.ts";
import { vocabulary } from "../internal/vocabulary.ts";
import type { Scheme } from "../types/Scheme.ts";
import type { StyleProp } from "../types/StyleProp.ts";
import type { TokenGroup } from "../types/TokenGroup.ts";
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
/** `media="screen"` and `media="print"` (k.aria Print), once an element writes `media`. */
const MEDIA = [
  "@media print{.k-media-screen{display:none!important}}",
  "@media screen{.k-media-print{display:none!important}}",
];
/** The responsive key that targets the printed page (k.aria Print), after every breakpoint. */
const PRINT = "print";

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
  // An overlay is a color with alpha (k.values Overlays): the message names the color group alone.
  const named = entry.groups.filter((g) => g !== "overlay");
  const want = named.length > 0 ? `a ${named.join(" or ")} token` : `one of ${kw.join(" ")}`;
  throw fail("E1801", `${prop}=${JSON.stringify(token).slice(0, 40)} is not ${want}`);
}

type Values = ReadonlyMap<string, string | { readonly light: string; readonly dark: string }>;

/** A layer of custom property blocks (k.schemes CSS): its selector, its condition, and the values it writes. */
type Layer = {
  readonly name: string;
  readonly selector: string;
  readonly media: string | undefined;
  readonly values: Values;
  /** Custom properties a theme writes for colors and overlays, re-declared in the subtree blocks whatever their form. */
  readonly theme: boolean;
  readonly print: boolean;
};

const at = (conds: readonly (string | undefined)[], body: string): string => {
  const c = conds.filter((x): x is string => x !== undefined);
  return c.length === 0 ? body : `@media ${c.join(" and ")}{\n${body}\n}`;
};

/** The values one group of a layer writes, keyed by custom property: a string, or a pair. */
function groupValues(
  out: Map<string, string | { light: string; dark: string }>,
  group: TokenGroup,
  entries: [string, unknown][],
): void {
  for (const [name, v] of entries) {
    const n = varName(group, name);
    if (typeof v === "string") out.set(n, value(group, name, v));
    else if (typeof v === "object" && v !== null) {
      const raw = group === "overlay" && Reflect.has(v, "value") ? Reflect.get(v, "value") : v;
      if (typeof raw === "string") out.set(n, value(group, name, raw));
      else
        out.set(n, {
          light: value(group, name, String(Reflect.get(Object(raw), "light"))),
          dark: value(group, name, String(Reflect.get(Object(raw), "dark"))),
        });
    }
  }
}

const GROUPS: readonly TokenGroup[] = [
  "color",
  "overlay",
  ...tokenGroups.filter((g) => g !== "color" && g !== "breakpoint"),
];

/**
 * A block of custom properties under its conditions, each color in its sRGB form, followed at once, when one of its
 * colors lies outside sRGB and the layer is not `print`, by a block of the same selector under its conditions with
 * `screen` and `(color-gamut: p3)` declaring those properties again in their P3 forms (k.gamut CSS).
 */
function block(
  out: string[],
  conds: readonly (string | undefined)[],
  selector: string,
  lead: readonly string[],
  decls: readonly (readonly [string, string])[],
  print: boolean,
): void {
  const srgb = decls.map(([n, v]) => `${n}:${valueInForm(v, "sRGB")}`);
  out.push(at(conds, `${selector}{${[...lead, ...srgb].join(";")}}`));
  if (print) return;
  const wide = decls.filter(([, v]) => valueInForm(v, "P3") !== valueInForm(v, "sRGB"));
  if (wide.length === 0) return;
  const p3 = wide.map(([n, v]) => `${n}:${valueInForm(v, "P3")}`);
  const own = conds.filter((c) => c !== "screen");
  out.push(at(["screen", ...own, "(color-gamut: p3)"], `${selector}{${p3.join(";")}}`));
}

/** The blocks of one layer (k.schemes CSS), in order. */
function layerBlocks(l: Layer, schemes: readonly Scheme[], subtree: boolean, top: boolean): string[] {
  const both = schemes.length === 2;
  const first = schemes[0] ?? "light";
  const main: [string, string][] = [];
  const dark: [string, string][] = [];
  for (const [n, v] of l.values) {
    if (typeof v === "string") main.push([n, v]);
    else {
      main.push([n, both ? v.light : v[first]]);
      if (both) dark.push([n, v.dark]);
    }
  }
  const lead = top
    ? [`color-scheme:${both ? "light dark" : first}`]
    : l.print
      ? ["color-scheme:light", "print-color-adjust:exact", "-webkit-print-color-adjust:exact"]
      : [];
  const out: string[] = [];
  if (lead.length + main.length > 0) block(out, [l.media], l.selector, lead, main, l.print);
  if (l.print) return out;
  if (both && (top || dark.length > 0)) {
    block(
      out,
      ["screen", l.media, "(prefers-color-scheme: dark)"],
      `${l.selector}:not([data-k-scheme="light"])`,
      [],
      dark,
      false,
    );
    block(out, ["screen", l.media], `${l.selector}[data-k-scheme="dark"]`, ["color-scheme:dark"], dark, false);
    if (top) out.push(`:root[data-k-scheme="light"]{color-scheme:light}`);
  }
  if (subtree)
    for (const sc of schemes) {
      const decls: [string, string][] = [];
      for (const [n, v] of l.values) {
        const colorish = n.startsWith("--k-color-") || n.startsWith("--k-overlay-");
        if (typeof v !== "string") decls.push([n, v[sc]]);
        else if (l.theme && colorish) decls.push([n, v]);
      }
      block(out, ["screen", l.media], `${l.selector} [data-k-scheme="${sc}"]`, [`color-scheme:${sc}`], decls, false);
    }
  return out;
}

/**
 * The custom properties (k.schemes CSS), as layers: the top-level tokens on `:root`, each `choice` theme on
 * `:root[data-k-theme="<name>"]`, the `contrast` theme under `(prefers-contrast: more)`, the `print` theme under
 * `print`. With both schemes the dark values follow the system preference on screen until `data-k-scheme` on `<html>`
 * overrides it; once an element writes `scheme`, each screen layer re-declares its scheme values on that subtree. With
 * `themes`, the blocks sit in `@layer keel.tokens`, `keel.theme`, `keel.contrast` and `keel.print`; with none they are
 * unlayered.
 */
function rootBlocks(tokens: Tokens, subtree: boolean): string[] {
  const schemes = schemesOf(tokens);
  const top = new Map<string, string | { light: string; dark: string }>();
  const reduced: string[] = [];
  for (const group of GROUPS) {
    const entries = Object.entries(tokens[group] ?? {});
    groupValues(top, group, entries);
    if (group === "motion") for (const [name] of entries) reduced.push(`${varName(group, name)}:0ms`);
  }
  const topBlocks = layerBlocks(
    { name: "keel.tokens", selector: ":root", media: undefined, values: top, theme: false, print: false },
    schemes,
    subtree,
    true,
  );
  if (reduced.length > 0) topBlocks.push(`@media (prefers-reduced-motion: reduce){\n:root{${reduced.join(";")}}\n}`);
  const themes = Object.entries(tokens.themes ?? {});
  if (themes.length === 0) return topBlocks;
  const layers: Record<string, string[]> = { "keel.theme": [], "keel.contrast": [], "keel.print": [] };
  for (const [name, theme] of themes) {
    const values = new Map<string, string | { light: string; dark: string }>();
    for (const group of GROUPS) groupValues(values, group, Object.entries(Reflect.get(theme, group) ?? {}));
    const when = theme.when ?? "choice";
    const layer: Layer =
      when === "choice"
        ? {
            name: "keel.theme",
            selector: `:root[data-k-theme="${name}"]`,
            media: undefined,
            values,
            theme: true,
            print: false,
          }
        : when === "contrast"
          ? {
              name: "keel.contrast",
              selector: ":root",
              media: "(prefers-contrast: more)",
              values,
              theme: true,
              print: false,
            }
          : { name: "keel.print", selector: ":root", media: "print", values, theme: true, print: true };
    layers[layer.name]?.push(...layerBlocks(layer, schemes, subtree, false));
  }
  const wrap = (name: string, blocks: readonly string[]): string => `@layer ${name}{\n${blocks.join("\n")}\n}`;
  return [
    "@layer keel.tokens,keel.theme,keel.contrast,keel.print;",
    wrap("keel.tokens", topBlocks),
    ...Object.entries(layers)
      .filter(([, b]) => b.length > 0)
      .map(([n, b]) => wrap(n, b)),
  ];
}

const selectorsOf = (sel: string, state: PartState | undefined): string =>
  (state === undefined ? [""] : stateSelectors(state)).map((s) => `${sel}${s}`).join(",");

const ruleText = (r: Rule): string => `${selectorsOf(`.${r.cls}`, r.state)}{${r.body}}`;

const isStyleProp = (k: string): k is StyleProp => styleProps.some((p) => p === k);

/** The `keel.base` layer (k.ui Base): fixed rules, each `base` set on its role, and the `base.focus` ring. */
function baseLayer(tokens: Tokens, bps: readonly (readonly [string, string])[], media: boolean): string {
  const rules: string[] = [HIDDEN, TABLE_WRAP, TABLE_HEAD, SCROLL, ...(media ? MEDIA : [])];
  const byBp = new Map<string, string[]>();
  const decls = (ls: readonly SetLeaf[]): string => ls.map((l) => resolve(tokens, l.prop, l.token).body).join(";");
  for (const { role, selector } of baseRoles) {
    const set = tokens.base?.[role];
    const leaves = set === undefined ? [] : setLeaves(set);
    for (const l of leaves)
      if (l.breakpoint !== undefined && l.breakpoint !== PRINT && !bps.some(([n]) => n === l.breakpoint))
        throw fail(
          "E1801",
          `base.${role} breakpoint ${JSON.stringify(l.breakpoint).slice(0, 40)} is not a breakpoint token`,
        );
    const groups = [undefined, ...states.map((s) => s.key)].flatMap((state) =>
      [undefined, ...bps.map(([n]) => n), PRINT].map((bp) => ({
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
      else byBp.set(g.bp, [...(byBp.get(g.bp) ?? []), rule]);
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
    const inBp = byBp.get(name);
    if (inBp !== undefined)
      rules.push(`@media (min-width: ${value("breakpoint", name, width)}){\n${inBp.join("\n")}\n}`);
  }
  const inPrint = byBp.get(PRINT);
  if (inPrint !== undefined) rules.push(`@media print{\n${inPrint.join("\n")}\n}`);
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
  if (refused !== undefined) throw fail("E1807", `${refused.path.join(".")}: ${refused.what}`);
  const problem = focusProblem(tokens);
  if (problem !== null) throw fail("E1807", `base.focus: ${problem}`);
  const bps = Object.entries(tokens.breakpoint ?? {});
  const rules = new Map<string, Rule>();
  const add = (
    prop: StyleProp,
    token: string,
    breakpoint: string | undefined,
    state: PartState | undefined,
  ): string => {
    const bpIndex = breakpoint === undefined ? -1 : bps.findIndex(([n]) => n === breakpoint);
    if (bpIndex < 0 && breakpoint !== undefined && breakpoint !== PRINT)
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
      if (l.breakpoint !== undefined && l.breakpoint !== PRINT && !bps.some(([n]) => n === l.breakpoint))
        throw fail(
          "E1801",
          `look.${name} breakpoint ${JSON.stringify(l.breakpoint).slice(0, 40)} is not a breakpoint token`,
        );
    }
    looks.set(name, leaves);
  }
  const classes = input.usages.map((u) => {
    const out: string[] = [];
    const m = u.props.media;
    if (m === "screen" || m === "print") out.push(`k-media-${m}`);
    for (const prop of styleProps) {
      const token = u.props[prop];
      if (token !== undefined) out.push(add(prop, token, u.breakpoint, u.state));
    }
    if (u.look === undefined) return out;
    const set = looks.get(u.look);
    if (set === undefined) throw fail("E1801", `look=${JSON.stringify(u.look).slice(0, 40)} is not a look token`);
    const own = new Set(
      Object.keys(u.props)
        .filter(isStyleProp)
        .map((p) => `${u.state ?? ""}:${p}`),
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
    const inPrint = own.filter((r) => r.breakpoint === PRINT);
    if (inPrint.length > 0) out.push(`@media print{\n${inPrint.map(ruleText).join("\n")}\n}`);
    return out;
  };
  const subtree = input.usages.some((u) => u.props.scheme !== undefined);
  const media = input.usages.some((u) => u.props.media === "screen" || u.props.media === "print");
  const css = [...rootBlocks(tokens, subtree), baseLayer(tokens, bps, media), ...section(false), ...section(true)].join(
    "\n",
  );
  return { classes, css: `${css}\n` };
}
