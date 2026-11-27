// Shared fixture for the k.derived Derivation cache conformance files (not a test file). Public surface only: the `keel` binary over the household copy of derived-support.ts.
// Seed 1337 for every property in this suite.
// ASSUMED (as derived.test.ts): the default of `line` in the linked `@keel/std-text` is written `min ?? 1` in `line.ts` of the copy, and `keel check` of the household copy
// writes `line(<min>..40)` into `.keel/surface.json` for it.
import { cpSync, mkdirSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { OLD, type Tree, editStdText, keel, read } from "./derived-support.ts";

/** The text `surface.json` holds for `line`'s default `min` of `n` on the household's `name` field. */
export const lineSurface = (n: number): string => `line(${String(n)}..40)`;

/** `keel build` in `t.dir` (with `env`), then true when the views `keel check` left are the bytes it wrote. */
export function surfaceIsBuilt(t: Tree, env: Readonly<Record<string, string>> = {}): boolean {
  const before = read(t.dir, ".keel/surface.json");
  const out = keel(t.dir, ["build"], env);
  if (out.status !== 0) throw new Error(`keel build exited ${String(out.status)}: ${out.stdout.slice(-400)}`);
  return read(t.dir, ".keel/surface.json") === before;
}

/** A second copy of the linked `@keel/std-text` whose `line` default `min` is `min`, at `<base>/alt/std-text`; returns its path. */
export function secondCopy(t: Tree, min: number): string {
  const alt: Tree = { base: join(t.base, "alt"), dir: t.dir };
  mkdirSync(alt.base, { recursive: true });
  cpSync(join(t.base, "std-text"), join(alt.base, "std-text"), { recursive: true, verbatimSymlinks: true });
  editStdText(alt, "min ?? 1", `min ?? ${String(min)}`, false);
  return join(alt.base, "std-text");
}

const first = (files: readonly string[]): string => {
  const f = files[0];
  if (f === undefined) throw new Error("no line.ts edited");
  return f;
};

/** The linked copy's `line` reads its default `min` from `min.txt` (written `value`) beside `line.ts` with `reader` at import time. Returns the path of `min.txt`. */
export function readsMinFile(t: Tree, reader: "readFileSync" | "readFile", value: string): string {
  const at = join(t.base, "std-text", "min.txt");
  const expr =
    reader === "readFileSync"
      ? `Number(readFileSync(${JSON.stringify(at)}, "utf8").trim())`
      : "Number(MIN_TEXT.trim())";
  const files = editStdText(t, "min ?? 1", `min ?? ${expr}`, false);
  const file = join(t.base, first(files));
  const text = readFileSync(file, "utf8");
  const head =
    reader === "readFileSync"
      ? 'import { readFileSync } from "node:fs";\n'
      : `import { readFile } from "node:fs/promises";\nconst MIN_TEXT = await readFile(${JSON.stringify(at)}, "utf8");\n`;
  writeFileSync(file, head + text);
  writeMin(at, value);
  return at;
}

/** The linked copy's `line` reads its default `min` from `process.env.LINE_MIN` (1 when it is absent). */
export function readsMinEnv(t: Tree): void {
  editStdText(t, "min ?? 1", 'min ?? Number(process.env.LINE_MIN ?? "1")', false);
}

/** Writes `min.txt`, its modification time the old one so only its bytes tell. */
export function writeMin(at: string, value: string): void {
  writeFileSync(at, value);
  utimesSync(at, OLD, OLD);
}
