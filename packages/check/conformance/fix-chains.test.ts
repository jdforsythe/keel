// Spec: k.fixes, clause "No chain holds a step whose diagnostic carries a fix that the next step, or the probe, shows to be wrong: with every offered fix applied and no other edit, each chain's files compile at every step."
// Spec: k.fixes, clause "The chain `cleanup` has no step: `keel check` reports nothing on its start."
// Spec: k.fixes, clause "The chains `invalid`, `missing` and `bug` each take one step with no fix; the probes hold that a bad field answers `err` `schema.invalid`, an absent row `err` with the module's `missing` code and its `id`, and a row that must exist a defect whose `data` is `{ id }` and whose message holds no id."
// Spec: k.fixes, clause "The chain `rollback` takes one step, and its probe holds: with `work` rejecting with `w`, an object whose `code` is `40P01`, the function rejects with `w` itself after the statements `begin` and `rollback`; with `work` resolving, the statements are `begin` and `commit`."
// Seed 1337. The walk (k.fixes Fix chains): each chain under fix-chains/ has `start/`, optional `edit1/`, `edit2/`, `end/`, `steps.json` and `probe.test.ts`; the files of a state sit under `modules/<module>/`. At each step the first diagnostic `check` reports (code, message, whether it carries a fix) is read; a fix is applied with `git apply`, else the named edit is the next state. The project is type-checked at every state (`check` with the type pass on reports a TypeScript error as E1751). The fixed text is compared to `end/` exactly after both are laid out by the repository's formatter (biome, from stdin, the repository's configuration): quotes, semicolons, commas and whitespace are the formatter's, every other character must match.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { CHECK_CASE_BOUND } from "./check-time.ts";
import { manifestFile } from "./module-support.ts";
import { type Files, applyFix, checked } from "./rules-support.ts";

const DIR = join(import.meta.dirname, "fix-chains");
const CHAINS = ["retry", "rollback", "sdk", "json", "cleanup", "invalid", "missing", "timeout", "conflict", "bug"];
interface Step {
  code: string;
  fix: boolean;
  message?: string;
}
const ROOT = join(import.meta.dirname, "..", "..", "..");
/** The text laid out by the repository's formatter: a different quote, semicolon, comma or break is the formatter's, any other character is not. */
const norm = (source: string, path: string): string => {
  const r = spawnSync(join(ROOT, "node_modules", ".bin", "biome"), ["format", `--stdin-file-path=${path}`], {
    cwd: ROOT,
    input: source,
    encoding: "utf8",
  });
  if (r.status !== 0) throw new Error(`the formatter refused ${path}: ${r.stderr}`);
  return r.stdout;
};
const stateOf = (chain: string, module: string, state: string): Files => {
  const dir = join(DIR, chain, state);
  return readdirSync(dir)
    .sort()
    .map((name) => ({ path: `modules/${module}/${name}`, source: readFileSync(join(dir, name), "utf8") }));
};
const withManifest = (module: string, files: Files): Files => [
  manifestFile({ id: module, deps: [], capabilities: [], exports: [] }),
  ...files,
];
const normFiles = (files: Files): string[] => files.map((f) => `${f.path}:\n${norm(f.source, f.path)}`);

test("the ten chains of k.fixes Fix chains exist", () => {
  expect(
    readdirSync(DIR)
      .filter((n) => existsSync(join(DIR, n, "steps.json")))
      .sort(),
  ).toEqual([...CHAINS].sort());
});

for (const chain of CHAINS) {
  test(
    `the chain \`${chain}\` walks: each step's first diagnostic matches, the fix or the named edit gives the next state, the end passes check and type-checks, and equals the files reached`,
    () => {
      const spec: { module: string; steps: Step[] } = JSON.parse(readFileSync(join(DIR, chain, "steps.json"), "utf8"));
      let state = stateOf(chain, spec.module, "start");
      spec.steps.forEach((step, i) => {
        const ds = checked(withManifest(spec.module, state));
        const first = ds[0];
        expect(first?.code, `${chain} step ${i + 1}`).toBe(step.code);
        if (step.message !== undefined) expect(first?.message, `${chain} step ${i + 1}`).toBe(step.message);
        expect(first?.fix !== undefined, `${chain} step ${i + 1}: fix offered`).toBe(step.fix);
        if (step.fix && first?.fix !== undefined) {
          const patched = applyFix(withManifest(spec.module, state), first.fix);
          state = patched.filter((f) => f.path !== `modules/${spec.module}/module.ts`);
          expect(
            checked(patched).filter((d) => d.code === "E1751"),
            `${chain} step ${i + 1}: the fixed files compile`,
          ).toEqual([]);
        } else {
          state = stateOf(chain, spec.module, i + 1 < spec.steps.length ? `edit${i + 1}` : "end");
          expect(
            checked(withManifest(spec.module, state)).filter((d) => d.code === "E1751"),
            `${chain} step ${i + 1}: the edited files compile`,
          ).toEqual([]);
        }
      });
      const end = stateOf(chain, spec.module, spec.steps.length === 0 ? "start" : "end");
      expect(normFiles(state)).toEqual(normFiles(end));
      expect(checked(withManifest(spec.module, end)).map((d) => `${d.code} ${d.path}`)).toEqual([]);
    },
    CHECK_CASE_BOUND * 4,
  );
}

test("the chain `cleanup` has no step, and its end is its start", () => {
  const spec: { steps: Step[] } = JSON.parse(readFileSync(join(DIR, "cleanup", "steps.json"), "utf8"));
  expect(spec.steps).toEqual([]);
  expect(stateOf("cleanup", "m", "start")).toEqual(stateOf("cleanup", "m", "end"));
});

test("the chains `invalid`, `missing` and `bug` take one step with no fix, `rollback` one step with a fix", () => {
  for (const chain of ["invalid", "missing", "bug"]) {
    const spec: { steps: Step[] } = JSON.parse(readFileSync(join(DIR, chain, "steps.json"), "utf8"));
    expect(spec.steps.map((s) => s.fix)).toEqual([false]);
  }
  const rb: { steps: Step[] } = JSON.parse(readFileSync(join(DIR, "rollback", "steps.json"), "utf8"));
  expect(rb.steps.map((s) => s.fix)).toEqual([true]);
});
