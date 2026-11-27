import { clipMessage } from "@keel/schema/internal";
import type { Combo } from "../internal/contrast/Combo.ts";
import { combosIn } from "../internal/contrast/combosIn.ts";
import { failing } from "../internal/contrast/failing.ts";
import { judgeElements } from "../internal/contrast/judgeElements.ts";
import { setToken } from "../internal/contrast/setToken.ts";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { projectLooks } from "../internal/looks/projectLooks.ts";
import { parseFile } from "../internal/parseFile.ts";
import { str } from "../internal/str.ts";
import { tokenSetAt } from "../internal/tokenSetAt.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";
import type { SourceFile } from "../types/SourceFile.ts";

/** The user agent's text and canvas, where neither the element nor `base.page` names a color. */
const UA_FG = "#000000";
const UA_BG = "#FFFFFF";
const isRec = (v: unknown): v is Readonly<Record<string, unknown>> => typeof v === "object" && v !== null;
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whether theme `theme` of `tokens` writes color `name`. */
const writes = (tokens: unknown, theme: string, name: string): boolean => {
  const themes = isRec(tokens) ? tokens.themes : undefined;
  const t = isRec(themes) ? themes[theme] : undefined;
  const color = isRec(t) ? t.color : undefined;
  return isRec(color) && Object.hasOwn(color, name);
};

/** The offset of the first quoted key `name` in `source` at or after `from`, or undefined. */
function keyAt(source: string, name: string, from: number): number | undefined {
  const m = new RegExp(`(["'])${escape(name)}\\1\\s*:`, "g");
  m.lastIndex = from;
  const hit = m.exec(source);
  return hit === null ? undefined : hit.index;
}

/** Where theme `theme`'s object opens in `source` (its key after `themes`), or undefined. */
function themeAt(source: string, theme: string): number | undefined {
  const themes = source.search(/\bthemes\s*:/);
  if (themes < 0) return undefined;
  const m = new RegExp(`(?:["']${escape(theme)}["']|\\b${escape(theme)})\\s*:`, "g");
  m.lastIndex = themes;
  const hit = m.exec(source);
  return hit === null ? undefined : hit.index;
}

/**
 * The offset in `tokens.ts` where a library pair's finding lands (k.a11y-static Library contrast): the app's key for
 * its `fg`, else for its `bg`, in the latest layer on in the combination that writes it (`print`, `contrast`, `choice`,
 * then the top level), else the spread `...<id>Tokens.color`, else the file's start.
 */
function pairAt(
  host: SourceFile,
  tokens: unknown,
  combo: Combo | undefined,
  fg: string,
  bg: string,
  id: string,
): number {
  for (const name of [fg, bg]) {
    for (const theme of [...(combo?.layers ?? [])].reverse()) {
      if (!writes(tokens, theme, name)) continue;
      const open = themeAt(host.source, theme);
      const at = open === undefined ? undefined : keyAt(host.source, name, open);
      if (at !== undefined) return at;
    }
    const top = keyAt(host.source, name, 0);
    const themes = host.source.search(/\bthemes\s*:/);
    if (top !== undefined && (themes < 0 || top < themes)) return top;
  }
  const spread = host.source.indexOf(`...${id}Tokens.color`);
  return spread < 0 ? 0 : spread;
}

/**
 * E1804 (k.a11y, k.a11y-static): text whose `fg` contrasts below 4.5:1 (3:1 when large: `fontSize` >= 24px, or
 * >= 18.66px at `weight` >= 700) in each of the tokens' color schemes (k.schemes; in a library's own folder, both when
 * a shipped color is a pair) against its `bg`. Each `base` set (on its own `bg`, else `base.page`'s, else white) and
 * each look is judged at the project's `tokens.ts` (else its first file); a look a library ships, in its own folder at
 * its key in the shipped file. In an app file, a base element or `Part` holding text is judged with its `fg`, `bg`,
 * `fontSize` and `weight` resolved as the render check resolves them: its own literal prop, its literal look's set,
 * its role's `base` set, then its parent's through base elements, `Part` and the intrinsics that add no markup. At the
 * component's edge or below another component `bg` is not found and the rest are `base.page`'s; an element whose `fg`
 * or `bg` is unread (an expression, a responsive object, a computed look, a spread) or not found is left to the render
 * check; an unread size judges at 3:1. Text under a `hidden`, `disabled` (bare or `{true}`) or `aria-disabled="true"`
 * element is exempt, and `states` are not read. In an app, what fails in a listed library's file or look is reported
 * in `tokens.ts` once per pair and scheme, where the app can override (k.looks Library contrast). Tokens come from the
 * `tokens` project artifact; without it the rule reports nothing.
 */
export const lowContrast: RuleDef = {
  code: "E1804",
  message: (f) => {
    const form = str(f.data, "form");
    const tail = `is ${str(f.data, "ratio")}:1 in ${str(f.data, "scheme")}${form === "" ? "" : ` (${form})`}, needs ${str(f.data, "need")}:1`;
    if (str(f.data, "lib") !== "")
      return clipMessage(`${str(f.data, "fg")} on ${str(f.data, "bg")} ${tail}; override in tokens.ts`, 89);
    const set = str(f.data, "set");
    const backdrop = str(f.data, "over");
    const pair = `fg "${str(f.data, "fg")}" on bg "${str(f.data, "bg")}"${backdrop === "" ? "" : ` over "${backdrop}"`}`;
    return clipMessage(set === "" ? `${pair} ${tail}` : `${set}: ${pair} ${tail}`, 89);
  },
  see: "k.a11y",
  check: ({ file, ast, artifacts, project }) => {
    const tokens = artifacts.tokens;
    if (tokens === undefined) return [];
    const looks = projectLooks.get(project);
    const combos = combosIn(tokens, looks?.ownSchemes, looks?.ownThemes);
    const byName = new Map(combos.map((c) => [c.name, c]));
    const out: Finding[] = [];
    const base = isRec(tokens) && isRec(tokens.base) ? tokens.base : {};
    const page = base.page;
    const pageFg = setToken(page, "fg") ?? UA_FG;
    const pageBg = setToken(page, "bg") ?? UA_BG;
    // Where the project's token findings land: its `tokens.ts`, else its first file (as `tokenSetAt`).
    const host = project.find((f) => /(?:^|\/)tokens\.ts$/.test(f.path)) ?? project[0];
    // A listed library's pair, in an app: one finding per pair and scheme, in `tokens.ts`.
    const pairs = new Map<string, { bad: Readonly<Record<string, string>>; id: string }>();
    const libraryPair = (bad: Readonly<Record<string, string>>, id: string): void => {
      const key = `${bad.fg ?? ""}|${bad.bg ?? ""}|${bad.scheme ?? ""}`;
      if (!pairs.has(key)) pairs.set(key, { bad, id });
    };
    const sets: [string, unknown][] = Object.entries(base)
      .filter(([name]) => name !== "focus")
      .map(([name, set]) => [`base.${name}`, set]);
    if (isRec(tokens) && isRec(tokens.look))
      for (const [name, set] of Object.entries(tokens.look)) sets.push([`look.${name}`, set]);
    for (const [label, set] of sets) {
      const fg = setToken(set, "fg");
      const bg = setToken(set, "bg");
      if (fg === undefined && bg === undefined) continue;
      const bad = failing(
        tokens,
        combos,
        fg ?? pageFg,
        bg ?? pageBg,
        setToken(set, "fontSize"),
        setToken(set, "weight"),
      );
      if (bad === undefined) continue;
      const shipper = label.startsWith("look.") ? looks?.lookLibrary(label.slice("look.".length)) : undefined;
      if (shipper !== undefined) {
        // A library pair is reported once per pair and combination it fails in (k.a11y-static Library contrast).
        if (host?.path === file.path)
          for (const c of combos) {
            const one = failing(
              tokens,
              [c],
              fg ?? pageFg,
              bg ?? pageBg,
              setToken(set, "fontSize"),
              setToken(set, "weight"),
            );
            if (one !== undefined) libraryPair(one, shipper);
          }
        continue;
      }
      const at = tokenSetAt(file, project, label);
      if (at !== undefined) out.push(findingAt(file, at, { ...bad, set: label }));
    }
    if (host !== undefined && host.path === file.path && looks !== undefined)
      for (const f of project) {
        const id = looks.libraryFileOf(f.path);
        if (id === undefined || !/\.[jt]sx$/.test(f.path)) continue;
        const parsed = parseFile(f);
        if (parsed.ok)
          for (const c of combos)
            for (const { bad } of judgeElements(parsed.program, tokens, [c]).contrast) libraryPair(bad, id);
      }
    for (const { bad, id } of pairs.values())
      out.push(
        findingAt(file, pairAt(file, tokens, byName.get(bad.scheme ?? ""), bad.fg ?? "", bad.bg ?? "", id), {
          ...bad,
          lib: "1",
        }),
      );
    if (!isAppPath(file.path) || looks?.libraryFileOf(file.path) !== undefined) return out;
    for (const { at, bad } of judgeElements(ast, tokens, combos).contrast) out.push(findingAt(file, at, bad));
    return out;
  },
};
