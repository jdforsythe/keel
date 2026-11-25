// k.scaffold, Generators "`project`: ... module `app`, generated turbo, CI and deploy files (k.deploy), agent files (k.explain); `--workspace` (an app inside the Keel monorepo) adds `vitest.config.ts` instead of turbo, CI, agent files. No `index.html`."
// Seed 1337 (fast-check). Generated in process (Op "project"); ASSUMED input keys `name`, `adapter` and `workspace`.
import fc from "fast-check";
import { expect, test } from "vitest";
import { type Files, RUNS, SEED, apply, find, read } from "./fixtures.ts";

const out = (input: Record<string, unknown>): Files => apply("project", input, new Map()).files;
const nodeNames = (files: Files): string[] =>
  find(files, /^deploy\/[^/]+\/Dockerfile$/).map((p) => p.split("/")[1] ?? "");

test("project yields turbo.json, .github/workflows/ci.yml and, per node deployable, deploy/<name>/Dockerfile plus deploy/compose.yaml; none of them for a client or static deployable", () => {
  fc.assert(
    fc.property(fc.constantFrom("client", "node", "static", undefined), (adapter) => {
      const files = out(adapter === undefined ? { name: "shop" } : { name: "shop", adapter });
      expect(files.has("turbo.json")).toBe(true);
      expect(files.has(".github/workflows/ci.yml")).toBe(true);
      if (adapter === "node") {
        expect(nodeNames(files)).toHaveLength(1);
        expect(files.has("deploy/compose.yaml")).toBe(true);
        expect(read(files, `deploy/${nodeNames(files)[0]}/Dockerfile`)).toContain("node:22-slim");
      } else {
        expect(nodeNames(files)).toEqual([]);
      }
    }),
    { seed: SEED, numRuns: RUNS },
  );
});

test("project --workspace adds vitest.config.ts instead of turbo and CI, writes no index.html and no deploy file", () => {
  for (const adapter of ["client", "node", "static"]) {
    const files = out({ name: "shop", adapter, workspace: true });
    expect(files.has("index.html")).toBe(false);
    expect(files.has("vitest.config.ts")).toBe(true);
    expect(files.has("turbo.json")).toBe(false);
    expect(files.has(".github/workflows/ci.yml")).toBe(false);
    expect(find(files, /^deploy\//)).toEqual([]);
  }
});
