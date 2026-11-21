// Spec: k.shell, Conformance "`keel build` writes `deploy/web/tauri/a.json`; a changed byte is E1005 whose fix restores it; removing `tauri` removes it; a file `files` does not give stays."
// Seed: 1337 (the byte position and the replacement byte of the tamper are generated).
// Over a stub `@keel/std-tauri` whose target gives `a.json` (`shell-stub.ts`); the real binary: `keel build` writes it, `keel check` reads E1005 and its fix (a unified diff of the changed file).
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { A_JSON, SEED, SLOW, cleanup, run, stubProject, topologySrc, withCode } from "./shell-stub.ts";
import { applyDiff } from "./unified-diff.ts";

let dir = "";
beforeAll(() => {
  dir = stubProject();
}, SLOW);
afterAll(() => cleanup(dir));

const A = "deploy/web/tauri/a.json";
const OWN = "deploy/web/tauri/own.txt";

describe("k.shell: shell files over a stub package", () => {
  test(
    "`keel build` writes `deploy/web/tauri/a.json`; a changed byte is E1005 whose fix restores it; removing `tauri` removes it; a file `files` does not give stays.",
    () => {
      mkdirSync(join(dir, "deploy/web/tauri"), { recursive: true });
      writeFileSync(join(dir, OWN), "mine\n");
      expect(run(dir, ["build"]).status).toBe(0);
      expect(readFileSync(join(dir, A), "utf8")).toBe(A_JSON);
      expect(readFileSync(join(dir, OWN), "utf8")).toBe("mine\n");
      expect(withCode(run(dir, ["check"]), "E1005")).toEqual([]);

      fc.assert(
        fc.property(fc.nat(), fc.constantFrom("#", "%", "~"), (n, ch) => {
          const at = n % A_JSON.length;
          const tampered = `${A_JSON.slice(0, at)}${A_JSON[at] === ch ? "@" : ch}${A_JSON.slice(at + 1)}`;
          try {
            chmodSync(join(dir, A), 0o644);
            writeFileSync(join(dir, A), tampered);
            const found = withCode(run(dir, ["check"]), "E1005").filter((r) => r.path === A);
            expect(found).toHaveLength(1);
            const fix = found[0]?.fix;
            expect(typeof fix).toBe("string");
            expect(applyDiff(tampered, { action: "change", path: A, diff: String(fix) })).toBe(A_JSON);
          } finally {
            writeFileSync(join(dir, A), A_JSON);
          }
        }),
        { seed: SEED, numRuns: 4 },
      );

      chmodSync(join(dir, "topology.ts"), 0o644);
      writeFileSync(join(dir, "topology.ts"), topologySrc(false));
      expect(run(dir, ["build"]).status).toBe(0);
      expect(existsSync(join(dir, A))).toBe(false);
      expect(readFileSync(join(dir, OWN), "utf8")).toBe("mine\n");
    },
    SLOW,
  );
});
