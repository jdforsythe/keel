import { brandTokens } from "@keel/ui/brand";
import type { ObjectExpression, Program } from "oxc-parser";
import type { Edit } from "../../types/Edit.ts";
import { keyName } from "../keyName.ts";
import type { LookLibrary } from "./LookLibrary.ts";
import { tokensInit } from "./tokensInit.ts";

/** Each imported local name and the specifier it comes from, with whether `defineTokens` from `@keel/ui` is one. */
function importsOf(program: Program): { readonly from: ReadonlyMap<string, string>; readonly lastEnd: number } {
  const from = new Map<string, string>();
  let lastEnd = 0;
  for (const st of program.body) {
    if (st.type !== "ImportDeclaration") continue;
    lastEnd = st.end;
    for (const sp of st.specifiers)
      if (sp.type === "ImportSpecifier")
        from.set(sp.local.name, `${st.source.value}#${sp.imported.type === "Identifier" ? sp.imported.name : ""}`);
  }
  return { from, lastEnd };
}

/**
 * E1810's fix (k.looks Fix) as edits of `tokens.ts`: the import of `<id>Tokens` on a new line after the last import's line, and for each
 * group the shipped object holds, in k.ui's order with `look` last, `...<id>Tokens.<group>` after the last spread of
 * the literal's `<group>` object, or a new `<group>: { ...S.<group>, ...<id>Tokens.<group> }` at its end. `tokens` is
 * `defineTokens(<object literal>)`, or an imported name `S` taken as `defineTokens({ ...S })`. Null when the fix
 * does not apply (another initializer, or a group written as anything but an object literal). `others` gives the
 * groups another library's shipped object holds, for a spread of its `<id>Tokens`.
 */
export function e1810Edits(
  source: string,
  program: Program,
  lib: LookLibrary,
  others: (specifier: string) => ReadonlySet<string> | undefined,
): Edit[] | null {
  const found = tokensInit(program);
  if (found === undefined || lib.shipped === null) return null;
  const imports = importsOf(program);
  const { from } = imports;
  // After the last import's line, so a comment that ends it stays on it.
  const lineEnd = source.indexOf("\n", imports.lastEnd);
  const lastEnd = imports.lastEnd === 0 ? 0 : lineEnd < 0 ? source.length : lineEnd;
  const local = `${lib.id}Tokens`;
  const groups = [...lib.shipped.names.keys()];
  /** The groups the tokens a spread `...S` names hold: `brandTokens`'s, a library's shipped ones, else every group. */
  const holds = (name: string, group: string): boolean => {
    const at = from.get(name) ?? "";
    if (at === "@keel/ui/brand#brandTokens") return Object.hasOwn(brandTokens, group);
    const shipped = others(at.slice(0, at.indexOf("#")));
    return shipped === undefined || shipped.has(group);
  };
  const edits: Edit[] = [];
  const hasLocal = from.has(local);
  const importLine = `import { ${local} } from "${lib.name}/tokens";`;
  const { init } = found;
  let literal: ObjectExpression | undefined;
  if (init.type === "CallExpression" && init.callee.type === "Identifier" && init.callee.name === "defineTokens") {
    const arg = init.arguments[0];
    if (arg?.type !== "ObjectExpression" || init.arguments.length !== 1) return null;
    literal = arg;
  } else if (init.type !== "Identifier" || !from.has(init.name)) return null;
  const spreads =
    literal === undefined
      ? [init.type === "Identifier" ? init.name : ""]
      : literal.properties.flatMap((p) =>
          p.type === "SpreadElement" && p.argument.type === "Identifier" ? [p.argument.name] : [],
        );
  const added: string[] = [];
  for (const group of groups) {
    const prop = literal?.properties.find((p) => p.type === "Property" && keyName(p) === group);
    if (prop !== undefined && prop.type === "Property") {
      if (prop.value.type !== "ObjectExpression") return null;
      const obj = prop.value;
      const last = obj.properties.filter((p) => p.type === "SpreadElement").at(-1);
      const text = `...${local}.${group}`;
      if (last !== undefined) edits.push({ start: last.end, end: last.end, text: `, ${text}` });
      else edits.push({ start: obj.start + 1, end: obj.start + 1, text: ` ${text},` });
    } else {
      const base = spreads.filter((s) => holds(s, group)).map((s) => `...${s}.${group}`);
      added.push(`${group}: { ${[...base, `...${local}.${group}`].join(", ")} }`);
    }
  }
  if (literal === undefined) {
    const name = init.type === "Identifier" ? init.name : "";
    edits.push({
      start: init.start,
      end: init.end,
      text: `defineTokens({ ...${name}${added.map((a) => `, ${a}`).join("")} })`,
    });
  } else if (added.length > 0) {
    const props = literal.properties;
    const tail = props.at(-1);
    const at = tail === undefined ? literal.start + 1 : tail.end;
    const lead = tail === undefined ? " " : ", ";
    edits.push({ start: at, end: at, text: `${lead}${added.join(", ")}` });
  }
  const define = from.get("defineTokens") === "@keel/ui#defineTokens";
  const head = [define ? "" : 'import { defineTokens } from "@keel/ui";\n'].join("");
  if (head !== "") {
    const first = program.body.find((s) => s.type === "ImportDeclaration");
    const at = first?.start ?? 0;
    edits.push({ start: at, end: at, text: head });
  }
  if (!hasLocal) edits.push({ start: lastEnd, end: lastEnd, text: `${lastEnd === 0 ? "" : "\n"}${importLine}\n` });
  return edits;
}
