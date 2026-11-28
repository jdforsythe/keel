import { createRequire } from "node:module";
import path from "node:path";
import { type Expression, parseSync } from "oxc-parser";
import { shortPath } from "../internal/shortPath.ts";

/** One E1587 problem: the deployable, the entry's offset in the source, and the message. */
type Problem = { readonly deployable: string; readonly offset: number; readonly message: string };

const unwrap = (e: Expression): Expression =>
  e.type === "ParenthesizedExpression" || e.type === "TSAsExpression" || e.type === "TSSatisfiesExpression"
    ? unwrap(e.expression)
    : e;
const keyName = (k: { type: string; name?: unknown; value?: unknown }): string | undefined =>
  k.type === "Identifier" && typeof k.name === "string"
    ? k.name
    : k.type === "Literal" && typeof k.value === "string"
      ? k.value
      : undefined;

/**
 * The E1587 problems of `topology.ts` (`source`, k.topology Rules), in source order: each `styles` entry of a
 * deployable that is not a string literal (or a `styles` that is not an array literal), a relative or absolute path,
 * or a specifier that does not resolve from `root` (the project folder, by Node's package `exports`) to a `.css`
 * file. Unreadable source gives none: E1552 reports it.
 */
export function stylesProblems(source: string, root: string): Problem[] {
  const { program, errors } = parseSync("topology.ts", source, { sourceType: "module", lang: "ts" });
  if (errors.length > 0) return [];
  const def = program.body.find((s) => s.type === "ExportDefaultDeclaration");
  const d = def?.declaration;
  if (d === undefined || d.type === "FunctionDeclaration" || d.type === "ClassDeclaration") return [];
  if (d.type === "TSInterfaceDeclaration") return [];
  let e = unwrap(d);
  if (e.type === "CallExpression") {
    const arg = e.arguments[0];
    if (arg === undefined || arg.type === "SpreadElement") return [];
    e = unwrap(arg);
  }
  if (e.type !== "ObjectExpression") return [];
  const require = createRequire(path.join(root, "package.json"));
  const resolved = (spec: string): string | undefined => {
    try {
      return require.resolve(spec);
    } catch {
      return undefined;
    }
  };
  const out: Problem[] = [];
  for (const p of e.properties) {
    if (p.type !== "Property" || p.computed) continue;
    const name = keyName(p.key) ?? "";
    const v = unwrap(p.value);
    if (v.type !== "ObjectExpression") continue;
    for (const f of v.properties) {
      if (f.type !== "Property" || f.computed || keyName(f.key) !== "styles") continue;
      const list = unwrap(f.value);
      if (list.type !== "ArrayExpression") {
        out.push({ deployable: name, offset: list.start, message: `${name}: styles is not an array literal` });
        continue;
      }
      for (const x of list.elements) {
        if (x === null) continue;
        if (x.type !== "Literal" || typeof x.value !== "string") {
          out.push({ deployable: name, offset: x.start, message: `${name}: a styles entry is not a string literal` });
          continue;
        }
        const spec = x.value;
        const file = spec.startsWith(".") || spec.startsWith("/") ? undefined : resolved(spec);
        if (file === undefined || !file.endsWith(".css")) {
          const what =
            file === undefined
              ? spec.startsWith(".") || spec.startsWith("/")
                ? "a path"
                : "no package export"
              : "an export that is not a .css file";
          const head = `${name}: styles entry '`;
          const tail = `' is ${what}`;
          const shown = shortPath(spec, 89 - head.length - tail.length);
          out.push({ deployable: name, offset: x.start, message: `${head}${shown}${tail}` });
        }
      }
    }
  }
  return out;
}
