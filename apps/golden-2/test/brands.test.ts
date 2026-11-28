// @vitest-environment node
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { s } from "@keel/schema";
import { fixedTime } from "@keel/tooling/test-time";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterEach, describe, expect, it } from "vitest";

const app = join(dirname(fileURLToPath(import.meta.url)), "..");
const bin = join(app, "node_modules", "@keel", "cli", "src", "bin.ts");

/** A `keel check --format=json` diagnostic line, as far as these tests read it. */
const Diag = s.object({
  kind: s.literal("diag"),
  code: s.string(),
  path: s.string(),
  line: s.int(),
  message: s.string(),
  fix: s.string().optional(),
});

const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

/**
 * A copy of the `kitchen` module in a project of its own, linked to the app's packages, with `edit` applied to
 * `Recipe.schema.ts` and `deps` left as the app's manifest lists them or with `@keel/std-brands` taken out.
 */
function kitchenCopy(edit: (source: string) => string, brands: boolean): string {
  const root = tempDir("golden-2-brands-");
  made.push(root);
  mkdirSync(join(root, "modules"));
  cpSync(join(app, "modules", "kitchen"), join(root, "modules", "kitchen"), { recursive: true });
  symlinkSync(join(app, "node_modules"), join(root, "node_modules"));
  const schema = join(root, "modules", "kitchen", "Recipe.schema.ts");
  writeFileSync(schema, edit(readFileSync(schema, "utf8")));
  if (!brands) {
    const manifest = join(root, "modules", "kitchen", "module.ts");
    writeFileSync(manifest, readFileSync(manifest, "utf8").replace('"@keel/std-brands",', ""));
  }
  return root;
}

/** The E2101 findings `keel check` reports for the project at `root`. */
function brandFindings(root: string) {
  const run = spawnSync(process.execPath, [bin, "check", "--format=json"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, KEEL_AGENT: "1" },
  });
  return run.stdout.split("\n").flatMap((line) => {
    if (!line.startsWith("{")) return [];
    const d = Diag.parse(JSON.parse(line));
    return d.ok && d.value.code === "E2101" ? [d.value] : [];
  });
}

const lowercase = (source: string): string => source.replace('s.id("Recipe")', 's.id("recipe")');

/** Each case runs the `keel check` binary on a copy of the module, which takes seconds on a busy machine. */
describe("id brand case in the kitchen module", { timeout: fixedTime(60_000) }, () => {
  it("reports a lowercase recipe brand at its line, with the fix that restores Recipe", () => {
    const found = brandFindings(kitchenCopy(lowercase, true));
    expect(found.map((d) => [d.path, d.line, d.message])).toEqual([
      ["modules/kitchen/Recipe.schema.ts", 7, "id brand 'recipe' is not PascalCase; use 'Recipe'"],
    ]);
    expect(found[0]?.fix).toContain('+  id: s.id("Recipe"),');
  });
  it("reports nothing for the module as it is", () => {
    expect(brandFindings(kitchenCopy((source) => source, true))).toEqual([]);
  });
  it("does not run the rule when the manifest does not list the package", () => {
    expect(brandFindings(kitchenCopy(lowercase, false))).toEqual([]);
  });
});
