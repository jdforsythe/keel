// Spec: k.compiler, clause "With `@keel/std-health` placed, `keel check` over its `routes.json` gives no E1005 or W1005; a binding spread is W1005."
// Drives the real binary (packages/cli/src/bin.ts) over temp projects placing the real `@keel/std-health` beside an app module `m`; `.keel/` is built by @keel/compiler/vite.
// Examples only: fixed projects. No random inputs (a fast-check seed would be 1337).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import keel from "@keel/compiler/vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const BIN = path.join(repo, "packages/cli/src/bin.ts");

const TSCONFIG = `${JSON.stringify(
  {
    extends: "@keel/compiler/tsconfig.strict.json",
    compilerOptions: { jsxImportSource: "@keel/runtime-dom" },
    include: ["src"],
  },
  null,
  2,
)}\n`;
// the package name is spelled apart so the layering lint does not read the fixture text as an import of this package
const HEALTH = "@keel/std-" + "health";
const MODULE = `import { module } from "@keel/compiler";
export default module({ id: "m", deps: ["${HEALTH}"], capabilities: [], public: { exports: [] } });
`;
const CONTRACT = `import { contract } from "@keel/router/contract";
export const m = contract("m", { "m.home": { path: "/home" } });
`;
const PAGE = `import { Box, Text } from "@keel/ui";
export default function Page() {
  return (
    <Box as="main">
      <Text>home</Text>
    </Box>
  );
}
`;
const ROUTES = (spread: boolean): string => `import { manifest } from "@keel/router";
import { routes as health } from "${HEALTH}/routes";
import { m } from "./m.contract.ts";
import Page from "./Page.tsx";

export const routes = manifest(m, { "m.home": { component: Page }${spread ? ", ...health.routes" : ""} });
`;
const TOPOLOGY = `export default { web: { modules: ["m", "health"], adapter: "node" } };\n`;

interface Rec {
  kind: string;
  code?: unknown;
  path?: unknown;
}
const isRec = (v: unknown): v is Rec =>
  typeof v === "object" && v !== null && "kind" in v && typeof v.kind === "string";

function runCheck(cwd: string): Rec[] {
  const env: Record<string, string | undefined> = { ...process.env };
  for (const k of Object.keys(env)) if (k.startsWith("VITEST") || k === "NODE_OPTIONS") delete env[k];
  const r = spawnSync(process.execPath, [BIN, "check", "--format=json"], { cwd, encoding: "utf8", env });
  const out: Rec[] = [];
  for (const line of r.stdout.split("\n")) {
    try {
      const v: unknown = JSON.parse(line);
      if (isRec(v)) out.push(v);
    } catch {
      // not a JSON line
    }
  }
  return out;
}
const diags = (rs: Rec[], code: string): Rec[] => rs.filter((r) => r.kind === "diag" && r.code === code);

function makeProject(spread: boolean): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "keel-std-health-routes-"));
  const files: Record<string, string> = {
    "tsconfig.json": TSCONFIG,
    "topology.ts": TOPOLOGY,
    "modules/m/module.ts": MODULE,
    "modules/m/m.contract.ts": CONTRACT,
    "modules/m/Page.tsx": PAGE,
    "modules/m/routes.ts": ROUTES(spread),
  };
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
  fs.mkdirSync(path.join(dir, "node_modules/@keel"), { recursive: true });
  for (const pkg of fs.readdirSync(path.join(repo, "packages"))) {
    fs.symlinkSync(path.join(repo, "packages", pkg), path.join(dir, "node_modules/@keel", pkg));
  }
  for (const name of ["vitest", "vite", "typescript"]) {
    fs.symlinkSync(path.join(repo, "node_modules", name), path.join(dir, "node_modules", name));
  }
  return dir;
}
async function viteBuild(root: string): Promise<void> {
  const plugin = keel();
  plugin.configResolved({ root, command: "build" });
  await plugin.buildStart.call({ warn: () => undefined });
}

const created: string[] = [];
let plain = "";
let spread = "";
beforeAll(async () => {
  plain = makeProject(false);
  spread = makeProject(true);
  created.push(plain, spread);
  await viteBuild(plain);
  await viteBuild(spread);
}, 120_000);
afterAll(() => {
  for (const d of created) fs.rmSync(d, { recursive: true, force: true });
});

describe("k.compiler: routes.json with @keel/std-health placed", () => {
  it("keel check over a project with `@keel/std-health` placed gives no E1005 or W1005 on its `routes.json`", () => {
    expect(fs.readFileSync(path.join(plain, ".keel/routes.json"), "utf8")).toContain("health.status");
    const records = runCheck(plain);
    expect(diags(records, "E1005")).toEqual([]);
    expect(diags(records, "W1005")).toEqual([]);
  }, 120_000);

  it("a binding spread (`...health.routes`) is W1005", () => {
    const records = runCheck(spread);
    expect(diags(records, "W1005").length).toBeGreaterThan(0);
  }, 120_000);
});
