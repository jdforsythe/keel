// Rule E1560 (k.topology): the production environment fails `DeployEnv` (at startup).
// Seed 1337 (fc.assert below). Spawns the built `server.mjs`; only `KEEL_SECRET` is named by the spec as a key, so the other keys' failure shapes are not asserted.
import { fixedTime } from "@keel/tooling/test-time";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { buildNodeFixture, deployEnv } from "./topology-build-fixture.ts";

let fixture = "";
beforeAll(() => {
  fixture = buildNodeFixture();
}, fixedTime(90_000));
afterAll(() => fs.rmSync(fixture, { recursive: true, force: true }));

describe("k.topology: E1560", () => {
  test(
    "E1560 the production environment fails DeployEnv (at startup)",
    () => {
      const entry = path.join(fixture, "dist", "web", "server.mjs");
      fc.assert(
        fc.property(fc.stringMatching(/^[a-zA-Z0-9]{0,31}$/), (secret) => {
          const r = spawnSync(process.execPath, [entry], {
            cwd: fixture,
            encoding: "utf8",
            env: deployEnv({ KEEL_SECRET: secret }),
          });
          const out = `${r.stdout}${r.stderr}`;
          expect(r.status).toBe(1);
          expect(out).toContain("E1560");
          expect(out).toContain("KEEL_SECRET");
          if (secret !== "") expect(out).not.toContain(secret);
        }),
        { seed: 1337, numRuns: 5 },
      );
    },
    fixedTime(30_000),
  );
});
