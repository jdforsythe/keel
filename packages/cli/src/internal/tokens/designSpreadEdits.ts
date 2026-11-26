import type { Program } from "oxc-parser";
import type { SourceEdit } from "./SourceEdit.ts";
import { appendProperty } from "./appendProperty.ts";
import { importFacts } from "./importFacts.ts";
import { keyOf } from "./keyOf.ts";
import { tokensShape } from "./tokensShape.ts";

/**
 * The edits that make a `tokens.ts` take `designTokens` (k.cli Tokens), as k.looks Fix does for a library's shipped
 * tokens: the imports of `defineTokens` and `designTokens`, and for each of `groups` `...designTokens.<group>` after
 * the last spread of the literal's group object, or a new `<group>: { ...S.<group>, ...designTokens.<group> }` where
 * `holds(S, group)` says each spread name `S` has that group. Undefined when `tokens` is neither
 * `defineTokens({...})` nor a bare name, or a group is written as anything but an object literal.
 */
export function designSpreadEdits(
  source: string,
  program: Program,
  groups: readonly string[],
  holds: (name: string, group: string) => boolean,
): SourceEdit[] | undefined {
  const shape = tokensShape(program);
  if (shape === undefined) return undefined;
  const { literal, alias, init } = shape;
  const imports = importFacts(program);
  const spreads =
    literal === undefined
      ? [alias ?? ""]
      : literal.properties.flatMap((p) =>
          p.type === "SpreadElement" && p.argument.type === "Identifier" ? [p.argument.name] : [],
        );
  const edits: SourceEdit[] = [];
  const added: string[] = [];
  for (const group of groups) {
    const text = `...designTokens.${group}`;
    const prop = literal?.properties.find((p) => p.type === "Property" && keyOf(p) === group);
    if (prop === undefined || prop.type !== "Property") {
      const base = spreads.filter((s) => holds(s, group)).map((s) => `...${s}.${group}`);
      added.push(`${group}: { ${[...base, text].join(", ")} }`);
      continue;
    }
    if (prop.value.type !== "ObjectExpression") return undefined;
    const last = prop.value.properties.filter((p) => p.type === "SpreadElement").at(-1);
    if (last !== undefined) edits.push({ start: last.end, end: last.end, text: `, ${text}` });
    else edits.push({ start: prop.value.start + 1, end: prop.value.start + 1, text: ` ${text},` });
  }
  if (literal === undefined) {
    edits.push({
      start: init.start,
      end: init.end,
      text: `defineTokens({ ...${alias ?? ""}${added.map((a) => `, ${a}`).join("")} })`,
    });
  } else if (added.length > 0) edits.push(appendProperty(literal, added.join(", ")));
  if (imports.from.get("defineTokens") !== "@keel/ui#defineTokens")
    edits.push({
      start: imports.firstStart,
      end: imports.firstStart,
      text: 'import { defineTokens } from "@keel/ui";\n',
    });
  const eol = source.indexOf("\n", imports.lastEnd);
  const at = imports.lastEnd === 0 ? 0 : eol < 0 ? source.length : eol;
  const line = 'import { designTokens } from "./tokens.design.ts";';
  edits.push({ start: at, end: at, text: imports.lastEnd === 0 ? `${line}\n` : `\n${line}\n` });
  return edits;
}
