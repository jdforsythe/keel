import { type Expression, Visitor } from "oxc-parser";
import { BASE_ELEMENTS } from "../internal/BASE_ELEMENTS.ts";
import { clip } from "../internal/clip.ts";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { jsxLiteral } from "../internal/jsxLiteral.ts";
import { propertyOf } from "../internal/propertyOf.ts";
import { str } from "../internal/str.ts";
import { tokenSetAt } from "../internal/tokenSetAt.ts";
import { tokenSetMisses } from "../internal/tokenSetMisses.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

const isRec = (v: unknown): v is Readonly<Record<string, unknown>> => typeof v === "object" && v !== null;
const literalOf = (e: Expression): string | undefined =>
  e.type === "Literal" && typeof e.value === "string"
    ? e.value
    : e.type === "TemplateLiteral" && e.expressions.length === 0
      ? (e.quasis[0]?.value.cooked ?? undefined)
      : undefined;

/**
 * E1801 (k.ui) where `check` reads the tokens artifact: a literal `look="<name>"` on a base element or `Part`, or
 * `look: '<name>'` in a part style of `styles={{ part: {...} }}`, that `tokens.look` does not hold; and a token name
 * or breakpoint in a `base` set or a look that the tokens do not declare, reported at the project's `tokens.ts`
 * (else its first file). Without the tokens artifact it reports nothing; a computed look is not read.
 */
export const missingLook: RuleDef = {
  code: "E1801",
  message: (f) => {
    const look = str(f.data, "look");
    return look === ""
      ? clip(`${str(f.data, "set")} ${str(f.data, "what")}`, 89)
      : clip(`look="${look}" is not a look token`, 89);
  },
  see: "k.ui",
  check: ({ file, ast, artifacts, project }) => {
    const tokens = artifacts.tokens;
    if (tokens === undefined) return [];
    const out: Finding[] = [];
    for (const m of tokenSetMisses(tokens)) {
      const at = tokenSetAt(file, project, m.set);
      if (at !== undefined) out.push(findingAt(file, at, { set: m.set, what: m.what }));
    }
    if (!isAppPath(file.path)) return out;
    const looks = isRec(tokens) && isRec(tokens.look) ? tokens.look : {};
    const miss = (name: string, at: number): void => {
      if (!Object.hasOwn(looks, name)) out.push(findingAt(file, at, { look: name }));
    };
    new Visitor({
      JSXOpeningElement: (n) => {
        const name = n.name.type === "JSXIdentifier" ? n.name.name : "";
        const look = BASE_ELEMENTS.has(name) || name === "Part" ? jsxLiteral(n.attributes, "look") : undefined;
        if (look) miss(look.text, look.start);
        for (const a of n.attributes) {
          if (a.type !== "JSXAttribute" || a.name.type !== "JSXIdentifier" || a.name.name !== "styles") continue;
          const e = a.value?.type === "JSXExpressionContainer" ? a.value.expression : undefined;
          if (e?.type !== "ObjectExpression") continue;
          for (const p of e.properties) {
            if (p.type !== "Property" || p.value.type !== "ObjectExpression") continue;
            const lp = propertyOf(p.value, "look");
            const text = lp === null ? undefined : literalOf(lp.value);
            if (lp !== null && text !== undefined) miss(text, lp.value.start);
          }
        }
      },
    }).visit(ast);
    return out;
  },
};
