// Spec: k.shell, clause "The generated workflow's `web-tauri` job sets no `KEEL_ORIGIN` with `web` alone, and `KEEL_ORIGIN: ${{ vars.KEEL_ORIGIN }}` with `api`."
// k.shell, CI "The generated workflow (k.deploy) gains each `ShellJob` as `<name>-<job>` on its deployable's paths, with a `node` deployable in the topology `KEEL_ORIGIN` from `vars`"
// Seed: 1337 (the job's runner and extra `env` are generated).
// Over a stub `@keel/std-tauri` (`shell-stub.ts`): `keel build` writes `.github/workflows/ci.yml`; the job is read as the two-space-indented block as in shell-target-ci.test.ts.
// ASSUMPTION: the owner of the generated job is the scaffold's workflow template, but the clause is run through `keel build`, so it sits with the CLI's shell cases (RFC 0200, Conformance diff 5).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { SEED, SLOW, UNSET, cleanup, run, setStub, stubProject, topologySrc } from "./shell-stub.ts";

let dir = "";
beforeAll(() => {
  dir = stubProject();
}, SLOW);
afterAll(() => cleanup(dir));

const jobBlock = (yml: string, name: string): string => {
  const lines = yml.split("\n");
  const at = lines.findIndex((l) => l === `  ${name}:`);
  if (at < 0) return "";
  const end = lines.findIndex((l, i) => i > at && /^ {2}[^\s#]/.test(l));
  return lines.slice(at, end < 0 ? undefined : end).join("\n");
};
const webTauri = (server: boolean, runsOn: string, env: Record<string, string>): string => {
  writeFileSync(join(dir, "topology.ts"), topologySrc(true, server));
  setStub(dir, { jobs: [{ job: "tauri", runsOn, manual: false, steps: [], env }] });
  const r = run(dir, ["build"], UNSET);
  expect(r.status, r.out).toBe(0);
  return jobBlock(readFileSync(join(dir, ".github", "workflows", "ci.yml"), "utf8"), "web-tauri");
};

const runner = fc.constantFrom("ubuntu-24.04", "macos-15", "ubuntu-22.04");
const extraEnv = fc.dictionary(
  fc.stringMatching(/^[A-Z]{3,8}$/).map((k) => `X_${k}`),
  fc.stringMatching(/^[a-z]{1,6}$/),
  { maxKeys: 2 },
);

describe("k.shell: the generated workflow's KEEL_ORIGIN", () => {
  test(
    "the `web-tauri` job sets no `KEEL_ORIGIN` with `web` alone",
    () => {
      fc.assert(
        fc.property(runner, extraEnv, (runsOn, env) => {
          const job = webTauri(false, runsOn, env);
          expect(job).not.toBe("");
          expect(job).toContain("keel build --target tauri");
          expect(job).not.toContain("KEEL_ORIGIN");
        }),
        { seed: SEED, numRuns: 3 },
      );
    },
    SLOW,
  );

  test(
    "the `web-tauri` job sets `KEEL_ORIGIN: ${{ vars.KEEL_ORIGIN }}` with `api`",
    () => {
      fc.assert(
        fc.property(runner, extraEnv, (runsOn, env) => {
          const job = webTauri(true, runsOn, env);
          expect(job).not.toBe("");
          expect(job).toContain("KEEL_ORIGIN: ${{ vars.KEEL_ORIGIN }}");
          for (const [k, v] of Object.entries(env)) expect(job).toContain(`${k}: ${v}`);
        }),
        { seed: SEED, numRuns: 3 },
      );
    },
    SLOW,
  );
});
