// Spec: k.parity, clause "with `deps.json` as shipped: `import { mountRequests } from '@keel/router/internal'` in `packages/std-tauri/src/a.ts` passes; `@keel/store/internal` there, and `@keel/schema/internal` in `packages/std-x/src/a.ts`, are each one S0012; `@keel/std-jobs/tools/internal` in `packages/std-x/src/a.ts` passes."
// Home: no structure-lint conformance file exists; this sits beside the other tooling tests (tooling/test).
// S0013 (kernel code naming `@keel/std-`) is built later with another RFC and is not written here.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { testTime } from "../test-time.ts";

const lint = path.join(import.meta.dirname, "..", "structure-lint.mjs");
const made: string[] = [];
afterAll(() => {
  for (const d of made) fs.rmSync(d, { recursive: true, force: true });
});

/** Runs structure-lint over a throwaway root holding one file; returns its S0012 diagnostics. */
function s0012(file: string, source: string): { code: string; path: string }[] {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "keel-parity-"));
  made.push(root);
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), source);
  const r = spawnSync(process.execPath, [lint, "--root", root, "--format=json"], {
    encoding: "utf8",
    timeout: testTime(60_000),
  });
  return r.stdout
    .split("\n")
    .filter((l) => l.startsWith("{"))
    .map((l) => JSON.parse(l))
    .filter((d) => d.code === "S0012");
}

// Each case runs structure-lint over a throwaway root, a process of its own: about 0.6 s here, so 20 s.
describe("rfc:0169 conformance: S0012 with deps.json as shipped", { timeout: 20_000 }, () => {
  it("rfc:0169 conformance: `import { mountRequests } from '@keel/router/internal'` in `packages/std-tauri/src/a.ts` passes", () => {
    expect(
      s0012(
        "packages/std-tauri/src/a.ts",
        "import { mountRequests } from '@keel/router/internal';\nexport const a = mountRequests;\n",
      ),
    ).toEqual([]);
  });

  it("rfc:0169 conformance: `@keel/store/internal` in `packages/std-tauri/src/a.ts` is one S0012", () => {
    const d = s0012(
      "packages/std-tauri/src/a.ts",
      "import { secretGuard } from '@keel/store/internal';\nexport const a = secretGuard;\n",
    );
    expect(d).toHaveLength(1);
    expect(d[0]?.path).toBe("packages/std-tauri/src/a.ts");
  });

  it("rfc:0169 conformance: `@keel/schema/internal` in `packages/std-x/src/a.ts` is one S0012", () => {
    const d = s0012(
      "packages/std-x/src/a.ts",
      "import { secretPathOf } from '@keel/schema/internal';\nexport const a = secretPathOf;\n",
    );
    expect(d).toHaveLength(1);
    expect(d[0]?.path).toBe("packages/std-x/src/a.ts");
  });

  it("rfc:0169 conformance: `@keel/std-jobs/tools/internal` in `packages/std-x/src/a.ts` passes", () => {
    expect(
      s0012(
        "packages/std-x/src/a.ts",
        "import { helper } from '@keel/std-jobs/tools/internal';\nexport const a = helper;\n",
      ),
    ).toEqual([]);
  });
});
