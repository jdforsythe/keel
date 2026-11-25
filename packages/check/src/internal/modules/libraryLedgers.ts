import fs from "node:fs";
import path from "node:path";
import { libraryKind } from "@keel/compiler/std/libraryKind";
import { ledgerCount } from "../../ledgerCount.ts";
import { readLibraryLedger } from "../../readLibraryLedger.ts";
import type { Diagnostic } from "../../types/Diagnostic.ts";
import type { SourceFile } from "../../types/SourceFile.ts";
import type { Checked } from "../Checked.ts";
import { LIBRARY_LEDGER_BYTES } from "../LIBRARY_LEDGER_BYTES.ts";
import { isCodePath } from "../isCodePath.ts";
import type { ModuleInfo } from "./ModuleInfo.ts";
import { discoverModules } from "./discoverModules.ts";
import { moduleDiag } from "./moduleDiag.ts";

const parse = (text: string): unknown => {
  try {
    const v: unknown = JSON.parse(text);
    return v;
  } catch {
    return undefined;
  }
};

/** Whether the library folder `root` (project-relative, `/`-ended) of the project at `cwd` lies in a `node_modules` folder by its real path. */
function installed(cwd: string, root: string): boolean {
  try {
    return fs.realpathSync(path.resolve(cwd, root)).split(path.sep).includes("node_modules");
  } catch {
    // Not on disk (files given in memory): it lies where it is given, under `node_modules/`.
    return true;
  }
}

/** The E1162 messages for library `lib` (k.library Rules), from its files among `files`; none when it holds. */
function ledgerFaults(lib: ModuleInfo, files: readonly SourceFile[]): string[] {
  const name = lib.key;
  const read = readLibraryLedger(files.find((f) => f.path === `${lib.root}.keel/ledger.json`)?.source);
  if (!read.ok)
    return [
      read.fault === "missing"
        ? `${name} ships no .keel/ledger.json`
        : read.fault === "size"
          ? `${name} .keel/ledger.json is over ${LIBRARY_LEDGER_BYTES} bytes`
          : read.fault === "object"
            ? `${name} .keel/ledger.json is not a JSON object`
            : `${name} .keel/ledger.json fails its shape at ${read.key ?? ""}`,
    ];
  let unsafe = 0;
  let hostElements = 0;
  // A file given both as checked and as the project's is counted once.
  const seen = new Set<string>();
  for (const f of files)
    if (
      !seen.has(f.path) &&
      seen.add(f.path) &&
      isCodePath(f.path) &&
      (f.path.startsWith(`${lib.root}src/`) || f.path.startsWith(`${lib.root}unsafe/`))
    ) {
      const n = ledgerCount(f.path, f.source);
      unsafe += n.unsafe;
      hostElements += n.hostElements;
    }
  const out: string[] = [];
  if (read.value.unsafe !== unsafe) out.push(`${name} ships unsafe ${read.value.unsafe}, its files hold ${unsafe}`);
  if (read.value.hostElements !== hostElements)
    out.push(`${name} ships hostElements ${read.value.hostElements}, its files hold ${hostElements}`);
  return out;
}

/**
 * E1162 (k.library Rules): at each `deps` entry of an app or library manifest that names an installed library (kind
 * `library`, its real folder in a `node_modules` folder; a linked one has no published file to compare), one
 * diagnostic per fault of the library's `.keel/ledger.json` among `files`: missing, not a JSON object, failing k.ledger
 * File's shape at its first failing key, or else an `unsafe` or `hostElements` other than `ledgerCount` over the
 * library's `src/` and `unsafe/` code files among `files`: `unsafe` at the entry's opening quote, `hostElements` a column
 * after it, so `unsafe` sorts first. No fix.
 */
export function libraryLedgers(checked: readonly Checked[], files: readonly SourceFile[], cwd: string): Diagnostic[] {
  const modules = discoverModules(checked, files);
  const byKey = new Map(modules.map((m) => [m.key, m]));
  const faults = new Map<string, readonly string[]>();
  const faultsOf = (lib: ModuleInfo): readonly string[] => {
    const known = faults.get(lib.key);
    if (known !== undefined) return known;
    const pkg = parse(files.find((f) => f.path === `${lib.root}package.json`)?.source ?? "");
    const found = libraryKind(pkg, lib.key) === "library" && installed(cwd, lib.root) ? ledgerFaults(lib, files) : [];
    faults.set(lib.key, found);
    return found;
  };
  const out: Diagnostic[] = [];
  for (const m of modules)
    for (const e of m.manifest?.deps.entries ?? []) {
      const lib = e.value.startsWith("@") ? byKey.get(e.value) : undefined;
      if (lib === undefined || !lib.library) continue;
      // The `hostElements` fault one column after the opening quote, so the canonical order puts `unsafe` first.
      for (const msg of faultsOf(lib)) {
        const at = msg.includes(" ships hostElements ") ? e.start + 1 : e.start;
        out.push(moduleDiag("E1162", m.file, at, msg, undefined, "k.library"));
      }
    }
  return out;
}
