import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "esbuild";
import { type Expression, parseSync } from "oxc-parser";
import { appLibraries } from "../std/appLibraries.ts";

/** A literal's data: string and object literals with identifier or string keys; undefined for anything else. */
function dataOf(e: Expression): unknown {
  if (e.type === "Literal" && typeof e.value === "string") return e.value;
  if (e.type !== "ObjectExpression") return undefined;
  const out: Record<string, unknown> = {};
  for (const p of e.properties) {
    if (p.type !== "Property" || p.computed || p.method || p.shorthand) return undefined;
    const key = p.key.type === "Identifier" ? p.key.name : p.key.type === "Literal" ? String(p.key.value) : undefined;
    const v = dataOf(p.value);
    if (key === undefined || v === undefined) return undefined;
    out[key] = v;
  }
  return out;
}

/**
 * The module `tokens.ts`'s evaluation takes for a library's shipped tokens (k.looks Shipped tokens): `export const
 * <id>Tokens = <the literal's data>`, read from the file's text and never running it. A file whose literal cannot be
 * read gives a module that throws, which E1812 reports before any evaluation.
 */
function shippedModule(file: string, id: string): string {
  const source = fs.readFileSync(file, "utf8");
  const program = parseSync(file, source, { sourceType: "module", lang: "ts" }).program;
  for (const st of program.body) {
    const decl = st.type === "ExportNamedDeclaration" ? st.declaration : null;
    if (decl?.type !== "VariableDeclaration") continue;
    for (const d of decl.declarations) {
      const init = d.init;
      if (d.id.type !== "Identifier" || d.id.name !== `${id}Tokens` || init?.type !== "CallExpression") continue;
      const arg = init.arguments[0];
      const data = arg === undefined || arg.type === "SpreadElement" ? undefined : dataOf(arg);
      if (data !== undefined) return `export const ${id}Tokens = ${JSON.stringify(data)};\n`;
    }
  }
  return `throw new Error("E1812 ${id}Tokens.ts is no defineTokens literal");\n`;
}

/** The own folder's library (k.library-pack Own folder): its module id when `root` holds a library's `package.json`. */
function ownId(root: string): string | undefined {
  try {
    const pkg: unknown = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    if (typeof pkg !== "object" || pkg === null || Reflect.get(pkg, "keel") !== "library") return undefined;
    const manifest = fs.readFileSync(path.join(root, "module.ts"), "utf8");
    return /\bid:\s*['"]([A-Za-z][A-Za-z0-9]*)['"]/.exec(manifest)?.[1];
  } catch {
    return undefined;
  }
}

/**
 * An esbuild plugin for the evaluation of `tokens.ts` at `root`: `<name>/tokens` of each library the app lists, and
 * `./src/<id>Tokens.ts` imported from the root of a library's own folder, resolve to the module made from the
 * shipped literal (`shippedModule`), so no library's tokens file is evaluated.
 */
export function shippedTokensPlugin(root: string): Plugin {
  const at = new Map<string, string>();
  for (const lib of appLibraries(root))
    if (lib.id !== undefined) at.set(`${lib.name}/tokens`, `${lib.dir}\u0000${lib.id}`);
  const own = ownId(root);
  return {
    name: "keel-shipped-tokens",
    setup(b) {
      b.onResolve({ filter: /tokens|Tokens\.ts$/ }, (args) => {
        const hit = at.get(args.path);
        if (hit !== undefined) return { path: args.path, namespace: "keel-shipped", pluginData: hit };
        if (
          own !== undefined &&
          args.path === `./src/${own}Tokens.ts` &&
          path.resolve(args.resolveDir) === path.resolve(root)
        )
          return { path: args.path, namespace: "keel-shipped", pluginData: `${root}\u0000${own}` };
        return undefined;
      });
      b.onLoad({ filter: /.*/, namespace: "keel-shipped" }, (args) => {
        const [dir = "", id = ""] = String(args.pluginData).split("\u0000");
        return { contents: shippedModule(path.join(dir, "src", `${id}Tokens.ts`), id), loader: "js" };
      });
    },
  };
}
