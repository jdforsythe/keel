import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { clipMessage } from "@keel/schema/internal";
import { type Expression, type NewExpression, Visitor, parseSync } from "oxc-parser";
import type { BundledCopy } from "./BundledCopy.ts";

/** A first argument that is an absolute URL (`<scheme>:`): it names no file of the package. */
const ABSOLUTE = /^[A-Za-z][A-Za-z0-9+.-]*:/;

/** A library the app reads (k.library In an app): its package name and the real path of its folder. */
type Held = { readonly name: string; readonly dir: string };

/** The library among `libraries` whose real folder holds `file`, or undefined. */
function libraryOf(libraries: readonly Held[], file: string): Held | undefined {
  return libraries.find((l) => {
    const rel = path.relative(l.dir, file);
    return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
  });
}

/**
 * The package file as a message shows it: a library's at `node_modules/<name>/<f>` wherever its real folder is
 * (k.library In an app), any other at its path from its last `node_modules/` folder.
 */
function shown(file: string, lib: Held | undefined): string {
  if (lib !== undefined) return `node_modules/${lib.name}/${path.relative(lib.dir, file).split(path.sep).join("/")}`;
  const posix = file.split(path.sep).join("/");
  return posix.slice(posix.lastIndexOf("/node_modules/") + 1);
}

/** Whether `e` is `import.meta.url`. */
function isMetaUrl(e: Expression | undefined): boolean {
  return (
    e?.type === "MemberExpression" &&
    !e.computed &&
    e.object.type === "MetaProperty" &&
    e.object.meta.name === "import" &&
    e.object.property.name === "meta" &&
    e.property.type === "Identifier" &&
    e.property.name === "url"
  );
}

/** The text a first argument holds when it is a string literal or a template literal without an expression. */
function literalOf(e: Expression | undefined): string | undefined {
  if (e?.type === "Literal" && typeof e.value === "string") return e.value;
  if (e?.type === "TemplateLiteral" && e.expressions.length === 0) return e.quasis[0]?.value.cooked ?? undefined;
  return undefined;
}

/** The `new URL(<first>, import.meta.url)` calls of `source` (the file `file`), each first argument as given. */
function urlCalls(file: string, source: string): (Expression | undefined)[] {
  const out: (Expression | undefined)[] = [];
  const { program } = parseSync(file, source, { sourceType: "module" });
  new Visitor({
    NewExpression: (n: NewExpression) => {
      const [first, base] = n.arguments;
      if (n.callee.type !== "Identifier" || n.callee.name !== "URL" || base?.type === "SpreadElement") return;
      if (!isMetaUrl(base)) return;
      out.push(first?.type === "SpreadElement" ? undefined : first);
    },
  }).visit(program);
  return out;
}

/**
 * The files the bundled package files among `ids` (a server bundle's module ids) read beside themselves (k.server-deps
 * Files a bundled package reads), and the problems that stop the build (E1014, `E1014 <file> <message>`, `<file>` the
 * package file as `shown`). A package file is a module id under a `node_modules` folder, or one of `libraries`' files
 * (real paths: an installed, a linked and a project-held library alike); in each,
 * every `new URL(<first>, import.meta.url)`: a first argument that is a string literal (or a template literal without
 * an expression) naming an absolute URL is left alone; one naming the file's own folder (`.`, `./`) too; one naming a
 * path inside that folder is copied from there to the same path beside `server.mjs`, a file or a folder; a missing one,
 * one leaving the folder, a first argument of any other form, and two package files naming one path for different
 * files are each one problem. `new URL` with any other base is not read.
 */
export function bundledFiles(
  ids: readonly string[],
  libraries: readonly Held[] = [],
): { copies: BundledCopy[]; problems: string[] } {
  const copies = new Map<string, { readonly from: string; readonly by: string }>();
  const problems: string[] = [];
  const files = [...new Set(ids.filter((id) => !id.startsWith("\0")).map((id) => id.replace(/[?#].*$/, "")))].sort();
  for (const file of files) {
    const lib = path.isAbsolute(file) ? libraryOf(libraries, file) : undefined;
    if (!path.isAbsolute(file) || (lib === undefined && !file.split(path.sep).includes("node_modules"))) continue;
    let source: string;
    try {
      source = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    if (!source.includes("import.meta.url")) continue;
    const at = shown(file, lib);
    const problem = (message: string): void => void problems.push(`E1014 ${at} ${clipMessage(message, 89)}`);
    for (const first of urlCalls(file, source)) {
      const name = literalOf(first);
      if (name === undefined) {
        problem("reads new URL(x, import.meta.url) with x no string literal");
        continue;
      }
      if (ABSOLUTE.test(name)) continue;
      const target = fileURLToPath(new URL(name, pathToFileURL(file)));
      const rel = path.relative(path.dirname(file), target);
      const f = clipMessage(name, 40);
      if (rel === "") continue;
      if (rel.startsWith("..") || path.isAbsolute(rel)) {
        problem(`reads ${f}, outside its own folder`);
        continue;
      }
      if (!fs.existsSync(target)) {
        problem(`reads ${f}, which is missing`);
        continue;
      }
      const held = copies.get(rel);
      if (held !== undefined && held.from !== target && !same(held.from, target)) {
        problem(`reads ${f}, as ${clipMessage(held.by, 36)} reads another file`);
        continue;
      }
      if (held === undefined) copies.set(rel, { from: target, by: at });
    }
  }
  const list = [...copies].map(([rel, { from }]) => ({ from, rel }));
  return { copies: list.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0)), problems };
}

/** Whether two files hold the same bytes (folders never do). */
function same(a: string, b: string): boolean {
  try {
    return fs.statSync(a).isFile() && fs.statSync(b).isFile() && fs.readFileSync(a).equals(fs.readFileSync(b));
  } catch {
    return false;
  }
}
