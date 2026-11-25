import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { ledgerCount, readLibraryLedger } from "@keel/check";
import { libraryFiles } from "@keel/compiler/std/libraryFiles";
import type { SourceFile } from "../types/SourceFile.ts";
import { CODE_FILE } from "./CODE_FILE.ts";
import type { LibraryLedger } from "./LibraryLedger.ts";
import { isRecord } from "./isRecord.ts";
import { projectCounts } from "./projectCounts.ts";

const read = (file: string): string | undefined => (existsSync(file) ? readFileSync(file, "utf8") : undefined);

/**
 * The libraries of the project at `cwd` whose files are `files` (k.library Ledger), by name: each library of kind
 * `library` its manifests reach (`libraryFiles`), installed (its real folder in a `node_modules` folder) or linked. Its
 * counts are over its files' real paths; a file the project read holds at a path `projectCounts` names is counted
 * once, as the project's. An installed library's `.keel/ledger.json` gives its records (`readLibraryLedger`; a file
 * missing, misshapen or stating counts other than these gives none), each `{ item: '<name>/<file>#<export>', rung, evidence: 'library <version>' }`.
 */
export function libraryLedgers(cwd: string, files: readonly SourceFile[]): LibraryLedger[] {
  const libs = libraryFiles(cwd, files).filter((l) => l.kind === "library");
  if (libs.length === 0) return [];
  const root = realpathSync(cwd);
  const held = new Set(files.map((f) => f.path));
  return libs.map((lib) => {
    const pkg: unknown = JSON.parse(read(path.join(lib.dir, "package.json")) ?? "{}");
    const v = isRecord(pkg) ? pkg.version : undefined;
    const version = typeof v === "string" ? v : "";
    let unsafe = 0;
    let hostElements = 0;
    let ownUnsafe = 0;
    let ownHostElements = 0;
    for (const file of lib.files.filter((f) => CODE_FILE.test(f))) {
      const n = ledgerCount(file, readFileSync(file, "utf8"));
      const rel = path.relative(root, file).split(path.sep).join("/");
      const by = held.has(rel) ? projectCounts(rel) : { unsafe: false, hostElements: false };
      unsafe += n.unsafe;
      hostElements += n.hostElements;
      if (!by.unsafe) ownUnsafe += n.unsafe;
      if (!by.hostElements) ownHostElements += n.hostElements;
    }
    const installed = lib.dir.split(path.sep).includes("node_modules");
    const shipped = installed ? readLibraryLedger(read(path.join(lib.dir, ".keel", "ledger.json"))) : undefined;
    // A file whose counts disagree with the recount fails (E1162): its items are not shown.
    const holds =
      shipped?.ok === true && shipped.value.unsafe === unsafe && shipped.value.hostElements === hostElements;
    const records =
      holds && shipped?.ok === true
        ? shipped.value.exports.map((e) => ({
            item: `${lib.name}/${e.file}#${e.name}`,
            rung: e.rung,
            evidence: `library ${version}`,
          }))
        : [];
    return { name: lib.name, version, unsafe, hostElements, ownUnsafe, ownHostElements, records };
  });
}
