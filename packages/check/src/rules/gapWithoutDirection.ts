import { Visitor } from "oxc-parser";
import { BASE_ELEMENTS } from "../internal/BASE_ELEMENTS.ts";
import type { StyleSource } from "../internal/StyleSource.ts";
import { clip } from "../internal/clip.ts";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { jsxStyleSource } from "../internal/jsxStyleSource.ts";
import { missingAt } from "../internal/missingAt.ts";
import { num } from "../internal/num.ts";
import { objectStyleSource } from "../internal/objectStyleSource.ts";
import { setKeys } from "../internal/setKeys.ts";
import { str } from "../internal/str.ts";
import { tokenSetGaps } from "../internal/tokenSetGaps.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

const MESSAGE = "gap without direction: name the axis its children are spaced along";
const ROLE: Readonly<Record<string, string>> = {
  Heading: "heading",
  Link: "link",
  Button: "button",
  Input: "control",
  TextArea: "control",
  Select: "control",
};
const isRec = (v: unknown): v is Readonly<Record<string, unknown>> => typeof v === "object" && v !== null;
const keyText = (k: string): string => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k));
type Dirs = readonly (readonly string[] | null)[];

/** The `direction` keys a token set gives, for itself or for one of its `states`. */
function setDirection(set: unknown, state?: string): Dirs {
  if (!isRec(set)) return [];
  const from = state === undefined ? set : isRec(set.states) ? set.states[state] : undefined;
  const keys = isRec(from) ? setKeys(from.direction) : undefined;
  return keys === undefined ? [] : [keys];
}

/** The text that adds a `direction` at breakpoint `at` to `src`, and where it goes. */
function insertion(src: StyleSource, at: string, start: number): { readonly pos: number; readonly text: string } {
  const open = src.direction?.open;
  if (open !== undefined && src.direction?.keys !== null) return { pos: open, text: ` ${keyText(at)}: 'column',` };
  if (src.jsx)
    return { pos: start, text: at === "base" ? 'direction="column" ' : `direction={{ ${keyText(at)}: 'column' }} ` };
  return { pos: start, text: at === "base" ? "direction: 'column', " : `direction: { ${keyText(at)}: 'column' }, ` };
}

/**
 * E1809 (k.ui): `gap` with no `direction` at or below its smallest breakpoint (`base`, then the `breakpoint` tokens in
 * order). Read on `@keel/ui` base elements and `Part`, on part styles in `styles={{ part: {...} }}`, on each
 * `states` entry (the base-state `direction` counts), and over the tokens artifact's `base` sets and looks. A computed
 * `direction`, a spread, a computed `look`, the element's literal `look` set and its `base` role set count as setting
 * one; a look's own `gap` is reported at the look. Set findings land on the project's `tokens.ts`, else its first
 * file. The fix inserts `direction="column"` (a `column` key at `gap`'s smallest breakpoint for a responsive one).
 */
export const gapWithoutDirection: RuleDef = {
  code: "E1809",
  message: (f) => {
    const set = str(f.data, "set");
    return set === ""
      ? MESSAGE
      : clip(`gap without direction in ${set}: name the axis its children are spaced along`, 89);
  },
  see: "k.ui",
  check: ({ file, ast, artifacts, project }) => {
    const tokens = artifacts.tokens;
    const out: Finding[] = [];
    const host = project.find((f) => /(?:^|\/)tokens\.ts$/.test(f.path)) ?? project[0];
    if (host?.path === file.path)
      for (const g of tokenSetGaps(tokens)) {
        let at = 0;
        for (const seg of g.set.split(".")) {
          const i = file.source.indexOf(seg, at);
          if (i >= 0) at = i;
        }
        out.push(findingAt(file, at, { set: g.set }));
      }
    if (!isAppPath(file.path)) return out;
    const order = isRec(tokens) && isRec(tokens.breakpoint) ? Object.keys(tokens.breakpoint) : [];
    const looks = isRec(tokens) && isRec(tokens.look) ? tokens.look : {};
    const base = isRec(tokens) && isRec(tokens.base) ? tokens.base : {};
    const visit = (src: StyleSource, inherited: Dirs, role: string | undefined, state?: string): void => {
      const lookSet = typeof src.look === "string" ? looks[src.look] : undefined;
      const dirs: Dirs = [
        ...inherited,
        ...(src.direction === undefined ? [] : [src.direction.keys]),
        ...(src.spread || src.look === null ? [null] : []),
        ...setDirection(lookSet, state),
        ...(role === undefined ? [] : setDirection(base[role], state)),
      ];
      const gap = src.gap;
      const at = gap === undefined || gap.keys === null ? undefined : missingAt(gap.keys, dirs, order);
      if (gap !== undefined && at !== undefined) {
        const ins = insertion(src, at, gap.start);
        out.push(findingAt(file, gap.start, { pos: ins.pos, text: ins.text }));
      }
      for (const [name, st] of src.states) {
        const own = [
          ...dirs,
          ...setDirection(lookSet, name),
          ...(role === undefined ? [] : setDirection(base[role], name)),
        ];
        visit(st, own, undefined, name);
      }
    };
    new Visitor({
      JSXOpeningElement: (n) => {
        const name = n.name.type === "JSXIdentifier" ? n.name.name : "";
        if (BASE_ELEMENTS.has(name) || name === "Part") visit(jsxStyleSource(n.attributes), [], ROLE[name]);
        for (const a of n.attributes) {
          if (a.type !== "JSXAttribute" || a.name.type !== "JSXIdentifier" || a.name.name !== "styles") continue;
          const e = a.value?.type === "JSXExpressionContainer" ? a.value.expression : undefined;
          if (e?.type !== "ObjectExpression") continue;
          for (const p of e.properties)
            if (p.type === "Property" && p.value.type === "ObjectExpression")
              visit(objectStyleSource(p.value), [], undefined);
        }
      },
    }).visit(ast);
    return out;
  },
  fix: (f) => {
    const pos = num(f.data, "pos");
    return pos < 0 ? null : [{ start: pos, end: pos, text: str(f.data, "text") }];
  },
};
