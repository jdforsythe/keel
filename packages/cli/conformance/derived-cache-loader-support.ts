// Shared fixture for the loader-route, computed-import and lookup-miss conformance files (not a test file). Public surface only: the `keel` binary over the household copy of derived-support.ts.
// Seed 1337 for every property in this suite.
// App code may not hold these forms (E1603 `Function`, E1607 `import()` as a value, E1752 one export per file, E1751 an untyped `.cjs`), so each lives in a package under the copy's `node_modules`, as `pgLike` does
// (derived-cache-observed-support.ts): `package.json` with `main` and `types`, an `index.d.ts`.
import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Out, Tree } from "./derived-support.ts";

/** One E1050 diagnostic record of a json run, whole. */
export type Raw = Record<string, unknown>;

/** Each E1050 record of a json run, whole (a record has `path` and `line` only when it has a location). */
export function e1050Raw(out: Out): Raw[] {
  const found: Raw[] = [];
  for (const row of out.stdout.split("\n")) {
    if (!row.startsWith("{")) continue;
    const v: unknown = JSON.parse(row);
    if (typeof v !== "object" || v === null || Reflect.get(v, "code") !== "E1050") continue;
    const rec: Raw = {};
    for (const k of Object.keys(v)) rec[k] = Reflect.get(v, k);
    found.push(rec);
  }
  return found;
}

/** The message of a record, `""` when it has none. */
export const messageOf = (r: Raw | undefined): string => {
  const m = r?.message;
  return typeof m === "string" ? m : "";
};

/**
 * A package `name` in the copy's `node_modules` whose `main` is `file` holding `code`, with an `index.d.ts` of `types`
 * (default: a module with no exports).
 */
export function pkg(t: Tree, name: string, file: string, code: string, types = "export {};\n"): string {
  const dir = join(t.dir, "node_modules", name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "package.json"),
    `{"name":${JSON.stringify(name)},"version":"1.0.0","main":${JSON.stringify(file)},"types":"index.d.ts"}\n`,
  );
  writeFileSync(join(dir, "index.d.ts"), types);
  writeFileSync(join(dir, file), code);
  return dir;
}

/** Writes `rel` under `dir`, its folders made. */
export function writeAt(dir: string, rel: string, text: string): string {
  const at = join(dir, rel);
  mkdirSync(dirname(at), { recursive: true });
  writeFileSync(at, text);
  return at;
}

/** A symbolic link `at` to `target`, its folders made. */
export function linkAt(at: string, target: string): void {
  mkdirSync(dirname(at), { recursive: true });
  symlinkSync(target, at);
}
