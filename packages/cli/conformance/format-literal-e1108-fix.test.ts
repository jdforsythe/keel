// k.formats, E1108's message "**E1108's message.** `formatLiteral text is not a string literal`, `formatLiteral format is no format type over a string`, `formatLiteral format <names> is not one registered format` (`<names>` joined by ` & `; `temporal.Instant`: 66 units), or `formatLiteral text does not parse as <name> (<rule>)`. For an unregistered format whose argument is imported from a `@keel/std-*` package the file's module does not list in `deps`, the fix adds that package to `deps` in `modules/<id>/module.ts`; that only a stdlib format has a literal form is `keel explain`'s."
// k.formats, Rules "... at the argument at fault; fix: below, else none."
// Seed: 1337 (no generated input: one project, the real `keel` binary in the OS tmpdir). Here `keel check` starts with no format registered, so a module that omits `@keel/std-temporal` from `deps` has `Instant` unregistered; in-process `check()` of packages/check has std-temporal registered by its setup, so the message-only forms are in packages/check/conformance/format-literal-E1108-message.test.ts.
// ASSUMPTION ("the exact diff"): the diff names `modules/app/module.ts` only, with one removed line (the module as written, on one line) and one added line (the same with `'@keel/std-temporal'` in `deps`).
import { fixedTime } from "@keel/tooling/test-time";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";
import { cleanup, diags, keel, materialize, readText } from "./compat-support.ts";

const MODULE = (deps: string): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: 'app', deps: [${deps}], capabilities: [], public: { exports: [] } })\n`;
const AT =
  "import { formatLiteral } from '@keel/schema'\nimport { Instant } from '@keel/std-temporal'\nexport const x = formatLiteral(Instant, '1970-01-01T00:00:00.000Z')\n";
let dir = "";
beforeAll(() => {
  dir = materialize({ "modules/app/module.ts": MODULE(""), "modules/app/At.ts": AT });
}, fixedTime(60_000));
afterAll(() => cleanup(dir));

const changed = (fix: string, sign: "-" | "+"): string[] =>
  fix.split("\n").filter((l) => l.startsWith(sign) && !l.startsWith(`${sign}${sign}${sign}`));
const fixOf = (): string => {
  const d = diags(keel(dir, ["check"]), "E1108");
  expect(d).toHaveLength(1);
  expect(d[0]?.message).toBe("formatLiteral format temporal.Instant is not one registered format");
  expect(String(d[0]?.message).length).toBe(66);
  return typeof d[0]?.fix === "string" ? d[0].fix : "";
};

test(
  "an unregistered `Instant` imported from a package the module does not list is `formatLiteral format temporal.Instant is not one registered format`, and its fix adds `'@keel/std-temporal'` to `deps` in `modules/app/module.ts`",
  () => {
    const fix = fixOf();
    expect(fix.startsWith("--- a/modules/app/module.ts\n+++ b/modules/app/module.ts\n")).toBe(true);
    expect(changed(fix, "-")).toEqual([`-${MODULE("").split("\n")[1]}`]);
    expect(changed(fix, "+")).toEqual([`+${MODULE("'@keel/std-temporal'").split("\n")[1]}`]);
  },
  fixedTime(60_000),
);

test(
  "the fix applies with `git apply` and `keel check` then reports no E1108",
  () => {
    const fix = fixOf();
    writeFileSync(join(dir, "fix.patch"), `${fix}\n`);
    execFileSync("git", ["apply", "--unsafe-paths", "--directory=.", "fix.patch"], { cwd: dir, stdio: "pipe" });
    expect(readText(dir, "modules/app/module.ts")).toBe(MODULE("'@keel/std-temporal'"));
    expect(diags(keel(dir, ["check"]), "E1108")).toEqual([]);
  },
  fixedTime(60_000),
);
