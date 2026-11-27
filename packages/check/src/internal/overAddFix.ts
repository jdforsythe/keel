import type { Expression, ObjectExpression, TSAsExpression } from "oxc-parser";
import type { SourceFile } from "../types/SourceFile.ts";
import { applyEdits } from "./applyEdits.ts";
import { keyName } from "./keyName.ts";
import { tokensInit } from "./looks/tokensInit.ts";
import { parseFile } from "./parseFile.ts";
import { unifiedDiff } from "./unifiedDiff.ts";

/** At most this many names in an overlay's `over` (k.values Overlays). */
const MOST = 8;

/** The object literal `defineTokens({ ... })` or `{ ... }` writes, through parentheses, `as` and `satisfies`. */
function literalOf(node: Expression | undefined): ObjectExpression | undefined {
  let n = node;
  while (
    n !== undefined &&
    (n.type === "ParenthesizedExpression" || n.type === "TSAsExpression" || n.type === "TSSatisfiesExpression")
  )
    n = n.expression;
  if (n?.type === "CallExpression") {
    const arg = n.arguments[0];
    return arg === undefined || arg.type === "SpreadElement" ? undefined : literalOf(arg);
  }
  return n?.type === "ObjectExpression" ? n : undefined;
}

/** The value of the last non-computed property `name` of `o`, else undefined. */
function member(o: ObjectExpression | undefined, name: string): Expression | undefined {
  let found: Expression | undefined;
  for (const p of o?.properties ?? []) if (p.type === "Property" && keyName(p) === name) found = p.value;
  return found;
}

/** Whether `node` is `<expression> as const`. */
function isAsConst(node: Expression | undefined): node is TSAsExpression {
  return (
    node?.type === "TSAsExpression" &&
    node.typeAnnotation.type === "TSTypeReference" &&
    node.typeAnnotation.typeName.type === "Identifier" &&
    node.typeAnnotation.typeName.name === "const"
  );
}

/**
 * The E1817 fix (k.themes Fixes) as a unified diff over the project's `tokens.ts`: `"<backdrop>"` added after the last
 * element of `overlay.<overlay>.over` when that is an array literal, bare or with `as const`, of fewer than 8 names; undefined otherwise.
 */
export function overAddFix(project: readonly SourceFile[], overlay: string, backdrop: string): string | undefined {
  const file = project.find(
    (f) => /(?:^|\/)tokens\.ts$/.test(f.path) && !/(?:^|\/)(?:modules|node_modules)\//.test(f.path),
  );
  if (file === undefined) return undefined;
  const parsed = parseFile(file);
  if (!parsed.ok) return undefined;
  const root = literalOf(tokensInit(parsed.program)?.init);
  const groups = member(root, "overlay");
  const entry = groups?.type === "ObjectExpression" ? member(groups, overlay) : undefined;
  const written = entry?.type === "ObjectExpression" ? member(entry, "over") : undefined;
  const over = isAsConst(written) ? written.expression : written;
  if (over?.type !== "ArrayExpression" || over.elements.length >= MOST) return undefined;
  if (over.elements.some((e) => e === null || e.type === "SpreadElement")) return undefined;
  const last = over.elements.at(-1);
  const text = JSON.stringify(backdrop);
  const edit =
    last === undefined || last === null
      ? { start: over.start + 1, end: over.start + 1, text }
      : { start: last.end, end: last.end, text: `, ${text}` };
  return unifiedDiff(file.path, file.source, applyEdits(file.source, [edit]));
}
