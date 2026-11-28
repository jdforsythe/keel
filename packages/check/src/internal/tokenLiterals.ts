import { tokenGroups } from "@keel/ui/css";
import { type Expression, type JSXAttributeItem, type ObjectExpression, type Program, Visitor } from "oxc-parser";
import { BASE_ELEMENTS } from "./BASE_ELEMENTS.ts";
import type { TokenLiteral } from "./TokenLiteral.ts";
import { keyName } from "./keyName.ts";

/** A string literal or a template with no expressions: its text and the offset of its opening quote. */
const literalOf = (e: Expression): { readonly text: string; readonly start: number } | undefined => {
  if (e.type === "Literal" && typeof e.value === "string") return { text: e.value, start: e.start };
  const cooked = e.type === "TemplateLiteral" && e.expressions.length === 0 ? e.quasis[0]?.value.cooked : undefined;
  return typeof cooked === "string" ? { text: cooked, start: e.start } : undefined;
};

/**
 * Every token name a file writes as a string literal on a base element or `Part` (k.a11y-static Token names): each
 * token prop's literal (directly, as a responsive object's value, under `states`), each responsive key but `base` and `print`,
 * each literal `look`, and the same in each part style of `styles={{ part: {...} }}`. A computed value is not read;
 * a keyword prop is closed by its type. In source order.
 */
export function tokenLiterals(ast: Program): TokenLiteral[] {
  const out: TokenLiteral[] = [];
  const prop = (name: string, value: string, at: number): void =>
    void out.push({ kind: "prop", prop: name, value, at });
  const look = (value: string, at: number): void => void out.push({ kind: "look", value, at });
  /** A token prop's value: a literal, or a responsive object of literals keyed by breakpoints. */
  const value = (name: string, e: Expression): void => {
    const lit = literalOf(e);
    if (lit !== undefined) prop(name, lit.text, lit.start);
    if (e.type !== "ObjectExpression") return;
    for (const p of e.properties) {
      if (p.type !== "Property") continue;
      const key = keyName(p);
      if (key !== null && key !== "base" && key !== "print")
        out.push({ kind: "breakpoint", value: key, at: p.key.start });
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
      const lit = v?.type === "Literal" && typeof v.value === "string" ? { text: v.value, start: v.start } : undefined;
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
}
