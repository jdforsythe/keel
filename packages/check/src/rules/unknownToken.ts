import { clipMessage } from "@keel/schema/internal";
import { tokenGroups } from "@keel/ui/css";
import { type Expression, type JSXAttributeItem, type ObjectExpression, Visitor } from "oxc-parser";
import { BASE_ELEMENTS } from "../internal/BASE_ELEMENTS.ts";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { keyName } from "../internal/keyName.ts";
import { str } from "../internal/str.ts";
import { tokenSetAt } from "../internal/tokenSetAt.ts";
import { tokenSetMisses } from "../internal/tokenSetMisses.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";
import type { SourceFile } from "../types/SourceFile.ts";

type Rec = Readonly<Record<string, unknown>>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null;
const NO_TOKENS = ": the project has no tokens.ts";

/** A string literal or a template with no expressions: its text and the offset of its opening quote. */
const literalOf = (e: Expression): { readonly text: string; readonly start: number } | undefined => {
  if (e.type === "Literal" && typeof e.value === "string") return { text: e.value, start: e.start };
  const cooked = e.type === "TemplateLiteral" && e.expressions.length === 0 ? e.quasis[0]?.value.cooked : undefined;
  return typeof cooked === "string" ? { text: cooked, start: e.start } : undefined;
};

/**
 * Whether the project of `file` has a `tokens.ts` at its root: a `tokens.ts` among the project's files in a folder
 * that holds `file` and is no module's (a library read in an app lies under `modules/`).
 */
const hasTokensFile = (file: SourceFile, project: readonly SourceFile[]): boolean =>
  project.some((f) => {
    const m = /^(.*\/)?tokens\.ts$/.exec(f.path);
    if (m === null) return false;
    const dir = m[1] ?? "";
    return file.path.startsWith(dir) && !dir.split("/").some((s) => s === "modules" || s === "node_modules");
  });

/**
 * E1801 (k.ui, k.a11y-static Token names). Over the tokens artifact: a token name or breakpoint in a `base` set or a
 * look that the tokens do not declare, at the project's `tokens.ts` (else its first file). In an app file, on a base
 * element or `Part`: each string literal given as a token prop (directly, as a responsive object's value, under
 * `states`), each responsive key but `base`, and each literal `look`; the same in each part style of
 * `styles={{ part: {...} }}`. A name its prop's groups (`tokenGroups`) lack, a key no `breakpoint` token names and a
 * look `look` lacks are each one finding at the literal or key. With no tokens artifact and no `tokens.ts` each such
 * literal and key is one, its message ending `: the project has no tokens.ts`; with a `tokens.ts` that gave no tokens
 * (E1807) none is judged. A computed value is not read; a keyword prop is closed by its type.
 */
export const unknownToken: RuleDef = {
  code: "E1801",
  message: (f) => {
    const kind = str(f.data, "kind");
    const value = clipMessage(str(f.data, "value"), 20);
    const tail = str(f.data, "none") === "" ? "" : NO_TOKENS;
    if (kind === "prop")
      return clipMessage(`${str(f.data, "prop")}="${value}" is not a ${str(f.data, "groups")} token${tail}`, 89);
    if (kind === "breakpoint") return clipMessage(`breakpoint "${value}" is not a breakpoint token${tail}`, 89);
    if (kind === "look") return clipMessage(`look="${value}" is not a look token${tail}`, 89);
    return clipMessage(`${str(f.data, "set")} ${str(f.data, "what")}`, 89);
  },
  see: "k.ui",
  check: ({ file, ast, artifacts, project }) => {
    const tokens = isRec(artifacts.tokens) ? artifacts.tokens : undefined;
    const out: Finding[] = [];
    if (tokens !== undefined)
      for (const m of tokenSetMisses(tokens)) {
        const at = tokenSetAt(file, project, m.set);
        if (at !== undefined) out.push(findingAt(file, at, { set: m.set, what: m.what }));
      }
    if (!isAppPath(file.path)) return out;
    if (tokens === undefined && hasTokensFile(file, project)) return out;
    const none = tokens === undefined ? { none: "1" } : {};
    const has = (group: string, name: string): boolean => {
      const g = tokens?.[group];
      return isRec(g) && Object.hasOwn(g, name);
    };
    const prop = (name: string, text: string, at: number): void => {
      const groups = tokenGroups[name] ?? [];
      if (!groups.some((g) => has(g, text)))
        out.push(findingAt(file, at, { kind: "prop", prop: name, value: text, groups: groups.join(" or "), ...none }));
    };
    const look = (text: string, at: number): void => {
      if (!has("look", text)) out.push(findingAt(file, at, { kind: "look", value: text, ...none }));
    };
    /** A token prop's value: a literal, or a responsive object of literals keyed by breakpoints. */
    const value = (name: string, e: Expression): void => {
      const lit = literalOf(e);
      if (lit !== undefined) prop(name, lit.text, lit.start);
      if (e.type !== "ObjectExpression") return;
      for (const p of e.properties) {
        if (p.type !== "Property") continue;
        const key = keyName(p);
        if (key !== null && key !== "base" && !has("breakpoint", key))
          out.push(findingAt(file, p.key.start, { kind: "breakpoint", value: key, ...none }));
        const v = literalOf(p.value);
        if (v !== undefined) prop(name, v.text, v.start);
      }
    };
    /** `states={{ <state>: {...} }}`: each state's token props. */
    const states = (e: Expression): void => {
      if (e.type !== "ObjectExpression") return;
      for (const p of e.properties)
        if (p.type === "Property" && p.value.type === "ObjectExpression") style(p.value, false);
    };
    /** A style object: its token props, and in a part style its `look` and `states`. */
    function style(obj: ObjectExpression, part: boolean): void {
      for (const p of obj.properties) {
        if (p.type !== "Property") continue;
        const key = keyName(p);
        if (key === null) continue;
        if (Object.hasOwn(tokenGroups, key)) value(key, p.value);
        else if (part && key === "look") {
          const lit = literalOf(p.value);
          if (lit !== undefined) look(lit.text, lit.start);
        } else if (part && key === "states") states(p.value);
      }
    }
    const attrs = (items: readonly JSXAttributeItem[], base: boolean): void => {
      for (const a of items) {
        if (a.type !== "JSXAttribute" || a.name.type !== "JSXIdentifier") continue;
        const name = a.name.name;
        const v = a.value;
        const e =
          v?.type === "JSXExpressionContainer" && v.expression.type !== "JSXEmptyExpression" ? v.expression : undefined;
        if (name === "styles") {
          if (e?.type === "ObjectExpression")
            for (const p of e.properties)
              if (p.type === "Property" && p.value.type === "ObjectExpression") style(p.value, true);
          continue;
        }
        if (!base) continue;
        const lit =
          v?.type === "Literal" && typeof v.value === "string" ? { text: v.value, start: v.start } : undefined;
        if (name === "look") {
          const l = lit ?? (e === undefined ? undefined : literalOf(e));
          if (l !== undefined) look(l.text, l.start);
        } else if (name === "states") {
          if (e !== undefined) states(e);
        } else if (Object.hasOwn(tokenGroups, name)) {
          if (lit !== undefined) prop(name, lit.text, lit.start);
          else if (e !== undefined) value(name, e);
        }
      }
    };
    new Visitor({
      JSXOpeningElement: (n) => {
        const name = n.name.type === "JSXIdentifier" ? n.name.name : "";
        attrs(n.attributes, BASE_ELEMENTS.has(name) || name === "Part");
      },
    }).visit(ast);
    return out;
  },
};
