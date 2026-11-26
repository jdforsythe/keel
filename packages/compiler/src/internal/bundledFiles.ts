import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { clipMessage } from "@keel/schema/internal";
import type { BundledCopy } from "./BundledCopy.ts";
import type { HeldLibrary } from "./HeldLibrary.ts";
import { libraryOf } from "./libraryOf.ts";
import { liftedRead } from "./liftedRead.ts";
import { packageFolder } from "./packageFolder.ts";
import { urlCalls } from "./urlCalls.ts";

/** A first argument that is an absolute URL (`<scheme>:`): it names no file of the package. */
const ABSOLUTE = /^[A-Za-z][A-Za-z0-9+.-]*:/;

/**
 * The package file as a message shows it: a library's at `node_modules/<name>/<f>` wherever its real folder is
 * (k.library In an app), any other at its path from its last `node_modules/` folder.
 */
function shown(file: string, lib: HeldLibrary | undefined): string {
  if (lib !== undefined) return `node_modules/${lib.name}/${path.relative(lib.dir, file).split(path.sep).join("/")}`;
  const posix = file.split(path.sep).join("/");
  return posix.slice(posix.lastIndexOf("/node_modules/") + 1);
}

/**
 * The files the bundled package files among `ids` (a server bundle's module ids) read beside themselves (k.server-deps
 * Files a bundled package reads), and the problems that stop the build (E1014, `E1014 <file> <message>`, `<file>` the
 * package file as `shown`). A package file is a module id under a `node_modules` folder, or one of `libraries`' files
 * (real paths: an installed, a linked and a project-held library alike); in each,
 * every `new URL(<first>, import.meta.url)`: a first argument that is a string literal (or a template literal without
 * an expression) naming an absolute URL is left alone; one naming the file's own folder (`.`, `./`) too; one naming a
 * path inside that folder is copied from there to the same path beside `server.mjs`, a file or a folder; one naming a
 * path above that folder and inside its package's folder (`packageFolder`) to that path with its leading `../`
 * segments removed (`liftedRead`; the server bundle's argument is rewritten to match, `rewriteLiftedReads`); a missing
 * one, one leaving the package's folder, a first argument of any other form, and two package files naming one path for
 * different files are each one problem. `new URL` with any other base is not read.
 */
export function bundledFiles(
  ids: readonly string[],
  libraries: readonly HeldLibrary[] = [],
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
    for (const { name } of urlCalls(file, source)) {
      if (name === undefined) {
        problem("reads new URL(x, import.meta.url) with x no string literal");
        continue;
      }
      if (ABSOLUTE.test(name)) continue;
      const target = fileURLToPath(new URL(name, pathToFileURL(file)));
      const own = path.relative(path.dirname(file), target);
      const f = clipMessage(name, 40);
      if (own === "") continue;
      const above = own.startsWith("..") || path.isAbsolute(own);
      const lifted = above ? liftedRead(file, name, packageFolder(file, lib)) : undefined;
      if (above && lifted === undefined) {
        problem(`reads ${f}, outside its package`);
        continue;
      }
      const rel = lifted === undefined ? own : lifted.split("/").join(path.sep);
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
