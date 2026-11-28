// Shared fixture for the k.derived Derivation cache conformance files (not a test file). Public surface only: the `keel` binary over the household copy of derived-support.ts.
// Seed 1337 for every property in this suite.
// ASSUMED (as derived.test.ts): the default of `line` in the linked `@keel/std-text` is written `min ?? 1` in `line.ts` of the copy, and `keel check` of the household copy
// writes `line(<min>..40)` into `.keel/surface.json` for it.
import { cpSync, mkdirSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { OLD, type Tree, editStdText, keel, put, read, sub } from "./derived-support.ts";

/** The text `surface.json` holds for `line`'s default `min` of `n` on the household's `name` field. */
export const lineSurface = (n: number): string => `line(${String(n)}..40)`;

/** `keel build` in `t.dir` (with `env`), then true when `view` (`.keel/surface.json`) as `keel check` left it is the bytes `keel build` wrote. */
export function viewIsBuilt(t: Tree, view: string, env: Readonly<Record<string, string>> = {}): boolean {
  const before = read(t.dir, view);
  const out = keel(t.dir, ["build"], env);
  if (out.status !== 0) throw new Error(`keel build exited ${String(out.status)}: ${out.stdout.slice(-400)}`);
  return read(t.dir, view) === before;
}

/** `viewIsBuilt` of `.keel/surface.json`. */
export const surfaceIsBuilt = (t: Tree, env: Readonly<Record<string, string>> = {}): boolean =>
  viewIsBuilt(t, ".keel/surface.json", env);

/** A second copy of the linked `@keel/std-text` whose `line` default `min` is `min`, at `<base>/alt/std-text`; returns its path. */
export function secondCopy(t: Tree, min: number): string {
  const alt: Tree = { base: join(t.base, "alt"), dir: t.dir };
  mkdirSync(alt.base, { recursive: true });
  cpSync(join(t.base, "std-text"), join(alt.base, "std-text"), { recursive: true, verbatimSymlinks: true });
  editStdText(alt, "min ?? 1", `min ?? ${String(min)}`, false);
  return join(alt.base, "std-text");
}

/**
 * The setup module's `routes.ts` gates `setup.form` with a guard of `modules/setup/gate.guard.ts`, a server-only file (k.boundary) of a module only a `node` deployable lists,
 * whose redirect is `members.signin` while `min.txt` (in the project, written `value`) holds `1`, else `app.start`, read with `reader` at import time (`node:fs` is refused in a browser file only, E1759; a stub is no evaluation).
 * `routes.json` holds that guard's redirect (k.router Artifacts). Returns the path of `min.txt`.
 */
export function readsMinFile(t: Tree, reader: "readFileSync" | "readFile", value: string): string {
  const at = join(t.dir, "min.txt");
  const read =
    reader === "readFileSync"
      ? `import { readFileSync } from "node:fs";\nconst MIN_TEXT = readFileSync(${JSON.stringify(at)}, "utf8");\n`
      : `import { readFile } from "node:fs/promises";\nconst MIN_TEXT = await readFile(${JSON.stringify(at)}, "utf8");\n`;
  put(
    t.dir,
    "modules/setup/gate.guard.ts",
    `${read}import { guard } from "@keel/router";
import { err, keelError, ok } from "@keel/schema";

export const gate = guard({ redirect: MIN_TEXT.trim() === "1" ? "members.signin" : "app.start" }, async ({ user }) =>
  user === "" ? err(keelError.denied.make({}, "sign in first")) : ok(null),
);
`,
  );
  sub(t.dir, "modules/setup/routes.ts", 'import { signedIn } from "../members/signedIn.guard.ts";\n', "");
  sub(
    t.dir,
    "modules/setup/routes.ts",
    "import { getHousehold }",
    'import { gate } from "./gate.guard.ts";\nimport { getHousehold }',
  );
  sub(t.dir, "modules/setup/routes.ts", "guard: signedIn,", "guard: gate,");
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
