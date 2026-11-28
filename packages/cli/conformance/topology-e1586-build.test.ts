// Spec: k.topology, clause "A placed stdlib module whose `./contract` export resolves and `./routes` does not is one E1586 at its `topology.ts` id in `keel check` and `keel build`; both or neither is none."
// k.topology, Rules "E1586 a placed stdlib module whose `./contract` resolves and `./routes` does not (at its id)"
// Seed: 1337 (no property: four fixed shapes). The `keel build` half (and `keel check`, through the real command) of
// packages/check/conformance/E1586-placed-module-no-routes.test.ts.
// ASSUMPTION: a stdlib package is found through an app
// module's `deps` in the project's `node_modules`; its module id is the `id` of its root `module.ts`; a failed
// build exits 1 and writes no `dist/`.
import { fixedTime } from "@keel/tooling/test-time";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { run } from "@keel/cli";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

type Case = "contract-only" | "routes-missing-file" | "both" | "neither";
const ID = "widgets";
let tmp = "";
beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "keel-e1586-build-"));
  fs.mkdirSync(path.join(tmp, "node_modules", "@keel"), { recursive: true });
  for (const p of ["compiler", "router", "schema", "server", "ctx"]) {
    fs.symlinkSync(path.resolve(import.meta.dirname, "..", "..", p), path.join(tmp, "node_modules", "@keel", p));
  }
});
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

const write = (p: string, text: string): void => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
};

const install = (shape: Case): void => {
  const dir = path.join(tmp, "node_modules", "@keel", `std-${ID}`);
  fs.rmSync(dir, { recursive: true, force: true });
  const exports: Record<string, string> = { "./module": "./module.ts" };
  if (shape !== "neither") exports["./contract"] = "./contract.ts";
  if (shape === "routes-missing-file" || shape === "both") exports["./routes"] = "./routes.ts";
  write(
    path.join(dir, "package.json"),
    JSON.stringify({ name: `@keel/std-${ID}`, version: "0.0.0", type: "module", exports }),
  );
  write(
    path.join(dir, "module.ts"),
    `export default { id: '${ID}', deps: [], capabilities: [], public: { exports: [] } }\n`,
  );
  if (shape !== "neither") write(path.join(dir, "contract.ts"), `export const ${ID} = { id: '${ID}' }\n`);
  if (shape === "both") write(path.join(dir, "routes.ts"), `export const routes = {}\n`);
};

const files = [
  {
    path: "topology.ts",
    source: `import { topology } from '@keel/server'\nexport default topology({\n  web: { modules: ['a', '${ID}'], adapter: 'node' },\n})\n`,
  },
  {
    path: "modules/a/module.ts",
    source: `import { module } from '@keel/compiler'\nexport default module({ id: 'a', deps: ['@keel/std-${ID}'], capabilities: [], public: { exports: [] } })\n`,
  },
];

const go = async (command: "build" | "check", shape: Case) => {
  install(shape);
  fs.rmSync(path.join(tmp, "dist"), { recursive: true, force: true });
  const r = await run([command, "--format=json"], { cwd: tmp, env: { KEEL_AGENT: "1" }, files });
  const e1586 = r.stdout.split("\n").filter((l) => l.includes('"E1586"'));
  return { r, e1586, wrote: fs.existsSync(path.join(tmp, "dist")) };
};

describe("k.topology: E1586 in `keel check` and `keel build`", () => {
  for (const command of ["check", "build"] as const) {
    for (const shape of ["contract-only", "routes-missing-file"] as const) {
      test(
        `${command}: a placed stdlib module with \`./contract\` and ${shape === "contract-only" ? "no `./routes` export" : "a `./routes` naming a missing file"} is one E1586 at its \`topology.ts\` id, exit 1${command === "build" ? ", nothing written" : ""}`,
        async () => {
          const { r, e1586, wrote } = await go(command, shape);
          expect(e1586).toHaveLength(1);
          expect(e1586[0]).toContain('"E1586"');
          expect(e1586[0]).toContain("topology.ts");
          expect(e1586[0]).toContain(ID);
          expect(r.code).toBe(1);
          if (command === "build") expect(wrote).toBe(false);
        },
        fixedTime(60_000),
      );
    }
    for (const shape of ["both", "neither"] as const) {
      test(
        `${command}: ${shape === "both" ? "`./contract` and `./routes` both resolving" : "neither export (a runner-only module)"} is no E1586`,
        async () => {
          const { e1586 } = await go(command, shape);
          expect(e1586).toEqual([]);
        },
        fixedTime(60_000),
      );
    }
  }
});
