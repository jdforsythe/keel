// k.a11y Artifacts: `keel test` loads `@keel/testing/setup` from a linked `@keel/testing` outside the project, and
// Vite's file rule still refuses a setup file outside the project and outside that one folder.
// The real `keel` binary over temp projects (OS tmpdir), with the conformance helpers that link every `@keel/*` package.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fixedTime } from "@keel/tooling/test-time";
import { afterAll, describe, expect, it } from "vitest";
import { ENV, keelProject } from "../conformance/a11y-project-support.ts";
import { keel, removeProject } from "../conformance/test-sim-project.ts";

const made: string[] = [];
afterAll(() => {
  for (const d of made) removeProject(d);
});
const TEST = `${ENV}
import { expect, it } from "vitest";
it("runs", () => {
  expect(Reflect.get(globalThis, "outsideSetup")).toBeUndefined();
});
`;

describe("keel test and Vite's file rule", () => {
  it(
    "runs a project whose linked @keel/testing lies outside it, and refuses a setup file from another folder outside it",
    () => {
      const outside = mkdtempSync(join(tmpdir(), "keel-outside-"));
      made.push(outside);
      const setup = join(outside, "setup.ts");
      writeFileSync(setup, "Reflect.set(globalThis, 'outsideSetup', 1);\n");
      const plain = keelProject("fs-allow-plain", { "test/a.test.ts": TEST });
      made.push(plain);
      const ok = keel(plain, ["test"]);
      expect(ok.status, ok.stdout).toBe(0);

      const config = `import { defineConfig } from "vitest/config";\nexport default defineConfig({ test: { setupFiles: [${JSON.stringify(setup)}] } });\n`;
      const refused = keelProject("fs-allow-refused", { "test/a.test.ts": TEST, "vitest.config.ts": config });
      made.push(refused);
      const run = keel(refused, ["test"]);
      expect(run.status).not.toBe(0);
      expect(run.stdout).toContain("Cannot find module");
      rmSync(setup, { force: true });
    },
    fixedTime(180_000),
  );
});
