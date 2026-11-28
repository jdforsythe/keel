// Spec: k.compiler, clause "Beside a literal `routes.ts`, `keel check` passes a genuine `routes.json`, is E1005 with a route added, W1005 with a computed `path`; `vite build` and a `node`-only `keel build` rewrite a differing one with W1005."
// Drives the real binary (packages/cli/src/bin.ts) over temp projects with modules/m/routes.ts; genuine `.keel/` is built by @keel/compiler/vite (or by `keel build` in the node-only case).
// Forged files are self-consistent: data and hash come from a public `compile` with other routes. No fast-check: fixed fixtures; no seed.
import { fixedTime } from "@keel/tooling/test-time";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "@keel/compiler";
import type { RouteEntry, SourceFile } from "@keel/compiler";
import keel from "@keel/compiler/vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const BIN = path.join(repo, "packages/cli/src/bin.ts");

const BADGE = `export default function Badge() {
  return <span id="badge.count">3</span>
}
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
const BADGE_UI = `import { Text } from "@keel/ui";
export default function Badge() {
  return <Text id="badge.count">3</Text>;
}
`;
const CONTRACT_TS = `import { contract } from "@keel/router/contract";
export const m = contract("m", {
  "m.home": { path: "/home" },
});
`;
const CONTRACT_TS_COMPUTED = `import { contract } from "@keel/router/contract";
const base = "/ho";
export const m = contract("m", {
  "m.home": { path: base + "me" },
});
`;
const ROUTES_TS = `import { manifest } from "@keel/router";
import { m } from "./m.contract.ts";
import Page from "./Page.tsx";

export const routes = manifest(m, {
  "m.home": { component: Page },
});
`;
const TOPOLOGY_NODE = `export default { api: { modules: ["m"], adapter: "node" } };\n`;
const TSCONFIG = `${JSON.stringify(
  {
    extends: "@keel/compiler/tsconfig.strict.json",
    compilerOptions: { jsxImportSource: "@keel/runtime-dom" },
    include: ["src"],
  },
  null,
  2,
)}\n`;

interface Rec {
  kind: string;
  code?: unknown;
  path?: unknown;
  message?: unknown;
}
function isRec(v: unknown): v is Rec {
  return typeof v === "object" && v !== null && "kind" in v && typeof v.kind === "string";
}

function scrubbedEnv(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith("VITEST") || k === "NODE_OPTIONS" || k === "TEST") continue;
    env[k] = v;
  }
  return env;
}

function runCheck(cwd: string): { status: number | null; records: Rec[] } {
  const r = spawnSync(process.execPath, [BIN, "check", "--format=json"], {
    cwd,
    encoding: "utf8",
    env: scrubbedEnv(),
  });
  const records: Rec[] = [];
  for (const line of r.stdout.split("\n")) {
    if (line.trim() === "") continue;
    try {
      const v: unknown = JSON.parse(line);
      if (isRec(v)) records.push(v);
    } catch {
      // non-JSON line: ignored
    }
  }
  return { status: r.status, records };
}
function runBuild(cwd: string): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync(process.execPath, [BIN, "build"], { cwd, encoding: "utf8", env: scrubbedEnv() });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}
const diags = (records: Rec[], code: string): Rec[] => records.filter((r) => r.kind === "diag" && r.code === code);
const paths = (rs: Rec[]): unknown[] => rs.map((r) => r.path);
const keelErrors = (records: Rec[]): Rec[] =>
  records.filter((r) => r.kind === "diag" && String(r.code).startsWith("E") && String(r.path).startsWith(".keel/"));

const canonical = (v: unknown): string => {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (typeof v === "object" && v !== null) {
    return `{${Object.entries(v)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, x]) => `${JSON.stringify(k)}:${canonical(x)}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
};
const artifactText = (data: unknown, hash: string): string => `${canonical({ data, hash })}\n`;

const HOME: RouteEntry = {
  path: "/home",
  params: null,
  search: null,
  actions: [],
  layout: null,
  guard: null,
  module: "m",
};
const ADMIN: RouteEntry = { ...HOME, path: "/admin" };
const sources: SourceFile[] = [{ path: "src/Badge.tsx", source: BADGE }];
const forgedText = (): string => {
  const f = compile(sources, { routes: { "m.home": HOME, "m.admin": ADMIN } });
  return artifactText(f.artifacts["routes.json"], f.hashes["routes.json"]);
};

function makeProject(prefix: string, files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
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
async function viteBuild(root: string): Promise<string[]> {
  const warnings: string[] = [];
  const plugin = keel();
  plugin.configResolved({ root, command: "build" });
  await plugin.buildStart.call({ warn: (m: string) => void warnings.push(String(m)) });
  return warnings;
}
const routesFileOf = (root: string): string => path.join(root, ".keel", "routes.json");
const writeRoutes = (root: string, text: string): void => {
  fs.chmodSync(routesFileOf(root), 0o644);
  fs.writeFileSync(routesFileOf(root), text);
};

const MODULE_TS = `import { module } from "@keel/compiler";\nexport default module({ id: "m", deps: [], capabilities: [], public: { exports: [] } });\n`;
const BASE_FILES = {
  "src/Badge.tsx": BADGE,
  "tsconfig.json": TSCONFIG,
  "modules/m/Page.tsx": PAGE,
  "modules/m/module.ts": MODULE_TS,
};
const created: string[] = [];
let proj = "";
let genuine = "";
let computedProj = "";
let nodeProj = "";

beforeAll(async () => {
  proj = makeProject("keel-routes-lit-", {
    ...BASE_FILES,
    "modules/m/m.contract.ts": CONTRACT_TS,
    "modules/m/routes.ts": ROUTES_TS,
  });
  computedProj = makeProject("keel-routes-lit-computed-", {
    ...BASE_FILES,
    "modules/m/m.contract.ts": CONTRACT_TS_COMPUTED,
    "modules/m/routes.ts": ROUTES_TS,
  });
  nodeProj = makeProject("keel-routes-lit-node-", {
    ...BASE_FILES,
    "src/Badge.tsx": BADGE_UI,
    "topology.ts": TOPOLOGY_NODE,
    "modules/m/m.contract.ts": CONTRACT_TS,
    "modules/m/routes.ts": ROUTES_TS,
  });
  created.push(proj, computedProj, nodeProj);
  await viteBuild(proj);
  genuine = fs.readFileSync(routesFileOf(proj), "utf8");
  await viteBuild(computedProj);
}, fixedTime(120_000));

afterAll(() => {
  for (const d of created) fs.rmSync(d, { recursive: true, force: true });
});

describe("k.compiler: routes.json beside a literal routes.ts", () => {
  it(
    "keel check passes a genuine routes.json (no W1005, no E1005)",
    () => {
      expect(genuine).toContain("/home");
      // sanity: the public compile reproduces the genuine bytes, so the forged fixture differs only by the added route
      const g = compile(sources, { routes: { "m.home": HOME } });
      expect(artifactText(g.artifacts["routes.json"], g.hashes["routes.json"])).toBe(genuine);
      const r = runCheck(proj);
      expect(diags(r.records, "W1005")).toEqual([]);
      expect(diags(r.records, "E1005")).toEqual([]);
      expect(keelErrors(r.records)).toEqual([]);
    },
    fixedTime(120_000),
  );

  it(
    "keel check is E1005 at .keel/routes.json for a self-consistent routes.json with a route added (exit 1)",
    () => {
      const text = forgedText();
      expect(text).not.toBe(genuine);
      try {
        writeRoutes(proj, text);
        const r = runCheck(proj);
        expect(paths(diags(r.records, "E1005"))).toEqual([".keel/routes.json"]);
        expect(diags(r.records, "W1005")).toEqual([]);
        expect(r.status).toBe(1);
      } finally {
        writeRoutes(proj, genuine);
      }
    },
    fixedTime(120_000),
  );

  it(
    "keel check is W1005 at .keel/routes.json naming the route for a computed path, and not E1005",
    () => {
      const r = runCheck(computedProj);
      const w = diags(r.records, "W1005");
      expect(paths(w)).toEqual([".keel/routes.json"]);
      expect(String(w[0]?.message)).toContain("m.home");
      expect(diags(r.records, "E1005")).toEqual([]);
      expect(keelErrors(r.records)).toEqual([]);
    },
    fixedTime(120_000),
  );

  it(
    "vite build over a forged routes.json warns one W1005 naming .keel/routes.json and rewrites the genuine content",
    async () => {
      writeRoutes(proj, forgedText());
      const warnings = await viteBuild(proj);
      const hit = warnings.filter((m) => m.includes("W1005"));
      expect(hit).toHaveLength(1);
      expect(hit[0]).toContain(".keel/routes.json");
      expect(fs.readFileSync(routesFileOf(proj), "utf8")).toBe(genuine);
    },
    fixedTime(120_000),
  );

  it(
    "vite build over the genuine routes.json emits no W1005",
    async () => {
      expect((await viteBuild(proj)).filter((m) => m.includes("W1005"))).toEqual([]);
      expect(fs.readFileSync(routesFileOf(proj), "utf8")).toBe(genuine);
    },
    fixedTime(120_000),
  );

  it(
    "a node-only keel build writes routes.json, rewrites a differing one with W1005, and a further build is silent",
    () => {
      const first = runBuild(nodeProj);
      expect(first.status).toBe(0);
      const file = routesFileOf(nodeProj);
      expect(fs.existsSync(file)).toBe(true);
      const built = fs.readFileSync(file, "utf8");
      expect(built).toContain("/home");

      writeRoutes(nodeProj, forgedText());
      expect(fs.readFileSync(file, "utf8")).not.toBe(built);
      const second = runBuild(nodeProj);
      expect(second.status).toBe(0);
      const hit = second.stderr.split("\n").filter((l) => l.includes("W1005") && l.includes(".keel/routes.json"));
      expect(hit.length).toBeGreaterThan(0);
      expect(fs.readFileSync(file, "utf8")).toBe(built);

      const third = runBuild(nodeProj);
      expect(third.status).toBe(0);
      expect(third.stderr).not.toContain("W1005");
      expect(third.stdout).not.toContain("W1005");
    },
    fixedTime(240_000),
  );
});
