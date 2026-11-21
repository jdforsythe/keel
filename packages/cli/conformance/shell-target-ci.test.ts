// Spec: k.shell, Conformance "A `ShellJob` `{ job: 'tauri', manual: true }` is a `web-tauri` job running `keel build --target tauri` on `workflow_dispatch` only."
// Spec: k.shell, CI "A `manual` job's `if` adds `github.event_name == 'workflow_dispatch'`, then a workflow trigger."
// Seed: 1337 (the other fields of the job, `runsOn` and `steps`, are generated).
// Over a stub `@keel/std-tauri` (`shell-stub.ts`): `keel build` writes `.github/workflows/ci.yml`.
// ASSUMPTION: a job is a two-space-indented key under `jobs:`; "on `workflow_dispatch` only" is the job's block naming `workflow_dispatch` where a job with `manual: false` does not; the spec gives no YAML for the gate.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { SEED, SLOW, cleanup, run, setStub, stubProject } from "./shell-stub.ts";

let dir = "";
beforeAll(() => {
  dir = stubProject();
}, SLOW);
afterAll(() => cleanup(dir));

/** The text of the job `name` of `ci.yml`: from its key to the next key at the same indent. */
const jobBlock = (yml: string, name: string): string => {
  const lines = yml.split("\n");
  const at = lines.findIndex((l) => l === `  ${name}:`);
  if (at < 0) return "";
  const end = lines.findIndex((l, i) => i > at && /^ {2}[^\s#]/.test(l));
  return lines.slice(at, end < 0 ? undefined : end).join("\n");
};
const ci = (): string => readFileSync(join(dir, ".github", "workflows", "ci.yml"), "utf8");

const runner = fc.constantFrom("ubuntu-24.04", "macos-15", "ubuntu-22.04");
const step = fc.stringMatching(/^[a-z]{3,8}$/).map((s) => `echo ${s}`);

describe("k.shell: CI over a stub package", () => {
  test(
    "A `ShellJob` `{ job: 'tauri', manual: true }` is a `web-tauri` job running `keel build --target tauri` on `workflow_dispatch` only.",
    () => {
      fc.assert(
        fc.property(runner, fc.array(step, { maxLength: 2 }), (runsOn, steps) => {
          setStub(dir, { jobs: [{ job: "tauri", runsOn, manual: true, steps, env: {} }] });
          expect(run(dir, ["build"]).status).toBe(0);
          const job = jobBlock(ci(), "web-tauri");
          expect(job).not.toBe("");
          expect(job).toContain(`runs-on: ${runsOn}`);
          expect(job).toContain("keel build --target tauri");
          expect(job).toContain("workflow_dispatch");
          expect(job).toMatch(/^ {4}if:.*github\.event_name == 'workflow_dispatch'/m);
          for (const s of steps) expect(job).toContain(s);
        }),
        { seed: SEED, numRuns: 3 },
      );
    },
    SLOW,
  );

  test(
    "A `ShellJob` `{ job: 'other', manual: false }` is a `web-other` job running `keel build --target tauri` that does not name `workflow_dispatch`.",
    () => {
      setStub(dir, { jobs: [{ job: "other", runsOn: "ubuntu-24.04", manual: false, steps: [], env: {} }] });
      expect(run(dir, ["build"]).status).toBe(0);
      const job = jobBlock(ci(), "web-other");
      expect(job).toContain("keel build --target tauri");
      expect(job).not.toContain("workflow_dispatch");
    },
    SLOW,
  );
});
