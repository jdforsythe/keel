import type { ObjectExpression, Program } from "oxc-parser";
import type { Edit } from "../../types/Edit.ts";
import { keyName } from "../keyName.ts";
import type { LookLibrary } from "./LookLibrary.ts";
import { importEdits } from "./importEdits.ts";
import type { ThemeGap } from "./themeGaps.ts";
import { tokensInit } from "./tokensInit.ts";

/** The object literal held by the property `key` of `o`, or undefined (absent, or not an object literal); null when it is held as anything else. */
function objectAt(o: ObjectExpression, key: string): ObjectExpression | undefined | null {
  const prop = o.properties.find((p) => p.type === "Property" && keyName(p) === key);
  if (prop === undefined || prop.type !== "Property") return undefined;
  return prop.value.type === "ObjectExpression" ? prop.value : null;
}

/**
 * E1810's fix for a theme (k.looks Fix, k.themes Library themes) as edits of `tokens.ts`: the import of `<id>Tokens`
 * when it is missing, and for each group the app's theme lacks names of, `...<id>Tokens.themes.<key>.<group>` after
 * the last spread of the theme's `<group>` object, or first in it when it holds none, or a new
 * `<group>: { ...<id>Tokens.themes.<key>.<group> }` at the end of the theme. `tokens` is `defineTokens(<object
 * literal>)` whose `themes.<theme>` is an object literal. Null when the fix does not apply.
 */
export function e1810ThemeEdits(source: string, program: Program, lib: LookLibrary, gap: ThemeGap): Edit[] | null {
  const found = tokensInit(program);
  const init = found?.init;
  if (init?.type !== "CallExpression" || init.callee.type !== "Identifier" || init.callee.name !== "defineTokens")
    return null;
  const literal = init.arguments.length === 1 ? init.arguments[0] : undefined;
  if (literal?.type !== "ObjectExpression") return null;
  const themes = objectAt(literal, "themes");
  const theme = themes === undefined || themes === null ? themes : objectAt(themes, gap.theme);
  if (theme === undefined || theme === null) return null;
  const local = `${lib.id}Tokens`;
  const edits: Edit[] = [];
  const added: string[] = [];
  for (const group of new Set(gap.missing.map(([g]) => g))) {
    const text = `...${local}.themes.${gap.key}.${group}`;
    const obj = objectAt(theme, group);
    if (obj === null) return null;
    if (obj === undefined) {
      added.push(`${group}: { ${text} }`);
      continue;
    }
    const last = obj.properties.filter((p) => p.type === "SpreadElement").at(-1);
    if (last !== undefined) edits.push({ start: last.end, end: last.end, text: `, ${text}` });
    else edits.push({ start: obj.start + 1, end: obj.start + 1, text: ` ${text},` });
  }
  if (added.length > 0) {
    const tail = theme.properties.at(-1);
    const at = tail === undefined ? theme.start + 1 : tail.end;
    edits.push({ start: at, end: at, text: `${tail === undefined ? " " : ", "}${added.join(", ")}` });
  }
  edits.push(...importEdits(source, program, local, lib.name));
  return edits;
}
