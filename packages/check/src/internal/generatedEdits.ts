import { canonicalJson } from "@keel/compiler/internal";
import type { Diagnostic } from "../types/Diagnostic.ts";
import type { SourceFile } from "../types/SourceFile.ts";
import { artifactDir } from "./artifactDir.ts";
import { surfaceDiffers } from "./compat/surfaceDiffers.ts";
import { unifiedDiff } from "./unifiedDiff.ts";

const GENERATED = /(?:^|\/)\.keel\/([^/]+\.json)$/;
/** `.keel/` files k.ledger reads that no derivation writes: an app's committed ledger and production tallies. */
const LEDGER_FILES = new Set(["ledger.json", "monitored.json"]);
/** The evaluated views (k.derived Derivations): compared only with a derivation the caller passes. */
const EVALUATED = new Set(["routes.json", "surface.json"]);

function parse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

const dataOf = (v: unknown): unknown => (typeof v === "object" && v !== null ? Reflect.get(v, "data") : undefined);

/**
 * E1005 (k.compiler, k.derived Frozen) for each `<dir>/.keel/<name>.json` among the checked files but the ledger's
 * `ledger.json` and `monitored.json` (k.ledger). A name no derivation writes is E1005 (remove it). A compiled view
 * (`compiled(dir)`, `null` for an evaluated `routes.json`) and an evaluated one (`derived[dir]`, when the caller passes
 * it) are compared byte for byte with the derivation: a differing view is E1005, naming for `surface.json` the first
 * store, contract or entry that differs; when only the bytes differ (the same data), the fix restores them. A view
 * with no derivation to compare (an evaluated one without `derived`, `schemes.json` without the project's tokens) is
 * not judged.
 */
export function generatedEdits(
  files: readonly SourceFile[],
  compiled: (dir: string) => Readonly<Record<string, string | null>>,
  derived: Readonly<Record<string, Readonly<Record<string, string>>>> | undefined,
): Diagnostic[] {
  const out: Diagnostic[] = [];
  const memo = new Map<string, Readonly<Record<string, string | null>>>();
  for (const file of files) {
    const name = GENERATED.exec(file.path)?.[1];
    if (name === undefined || LEDGER_FILES.has(name)) continue;
    const dir = artifactDir(file.path) ?? "";
    const views = memo.get(dir) ?? compiled(dir);
    memo.set(dir, views);
    const shown = `.keel/${name.slice(0, 30)}`;
    const at = { path: file.path, line: 1, col: 1, see: "k.compiler" };
    const known = Object.hasOwn(views, name) || EVALUATED.has(name) || name === "schemes.json";
    if (!known) {
      out.push({ kind: "diag", code: "E1005", ...at, message: `${shown} is no derived file; remove it` });
      continue;
    }
    const own = EVALUATED.has(name) ? undefined : views[name];
    const want = typeof own === "string" ? own : derived?.[dir]?.[name];
    if (want === undefined || want === file.source) continue;
    const have = parse(file.source);
    const same = have !== undefined && canonicalJson(dataOf(have)) === canonicalJson(dataOf(parse(want)));
    const first = name === "surface.json" && !same ? surfaceDiffers(dataOf(have), dataOf(parse(want))) : undefined;
    const message = same
      ? `${shown} differs from its derivation in bytes only`
      : first !== undefined
        ? `${shown} differs from the tree at ${first.slice(0, 30)}; keel check rewrites it`
        : `${shown} differs from the tree; keel check rewrites it`;
    const base: Diagnostic = { kind: "diag", code: "E1005", ...at, message };
    out.push(same ? { ...base, fix: unifiedDiff(file.path, file.source, want) } : base);
  }
  return out;
}
