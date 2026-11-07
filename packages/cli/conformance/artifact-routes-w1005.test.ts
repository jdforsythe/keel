// Spec: k.compiler, clause "Beside a `routes.ts`, a forged self-consistent `routes.json` is W1005 in `keel check` and in `vite build`, which rewrites it."
// Drives the real binary (packages/cli/src/bin.ts, 5 spawns) over a temp project with modules/m/routes.ts and real `.keel/` built by @keel/compiler/vite.
// Forged files are self-consistent: data and hash come from a public `compile` with other routes. No fast-check: the space is a fixed fixture; no seed.
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
const ROUTES_TS = `import { manifest } from "@keel/router";
export const routes = manifest({
  "m.home": { path: "/home", component: () => null },
});
`;
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

function runCheck(cwd: string): { status: number | null; records: Rec[] } {
  const env: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith("VITEST") || k === "NODE_OPTIONS" || k === "TEST") continue;
    env[k] = v;
  }
  const r = spawnSync(process.execPath, [BIN, "check", "--format=json"], { cwd, encoding: "utf8", env });
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

const ENTRY: RouteEntry = {
  path: "/forged",
  params: {},
  search: {},
  actions: [],
  layout: null,
  guard: null,
  module: "m",
};
const sources: SourceFile[] = [{ path: "src/Badge.tsx", source: BADGE }];

let proj = "";
let genuine = "";
const routesFile = (): string => path.join(proj, ".keel", "routes.json");
const writeRoutes = (text: string): void => {
  fs.chmodSync(routesFile(), 0o644);
  fs.writeFileSync(routesFile(), text);
};

async function build(): Promise<string[]> {
  const warnings: string[] = [];
  const plugin = keel();
  plugin.configResolved({ root: proj, command: "build" });
  await plugin.buildStart.call({ warn: (m: string) => void warnings.push(String(m)) });
  return warnings;
}

beforeAll(async () => {
  proj = fs.mkdtempSync(path.join(os.tmpdir(), "keel-routes-w1005-"));
  fs.mkdirSync(path.join(proj, "src"), { recursive: true });
  fs.mkdirSync(path.join(proj, "modules", "m"), { recursive: true });
  fs.writeFileSync(path.join(proj, "src", "Badge.tsx"), BADGE);
  fs.writeFileSync(path.join(proj, "modules", "m", "routes.ts"), ROUTES_TS);
  fs.writeFileSync(path.join(proj, "tsconfig.json"), TSCONFIG);
  fs.mkdirSync(path.join(proj, "node_modules/@keel"), { recursive: true });
  for (const pkg of fs.readdirSync(path.join(repo, "packages"))) {
    fs.symlinkSync(path.join(repo, "packages", pkg), path.join(proj, "node_modules/@keel", pkg));
  }
  for (const name of ["vitest", "vite", "typescript"]) {
    fs.symlinkSync(path.join(repo, "node_modules", name), path.join(proj, "node_modules", name));
  }
  await build();
  genuine = fs.readFileSync(routesFile(), "utf8");
}, 120_000);

afterAll(() => {
  fs.rmSync(proj, { recursive: true, force: true });
});

describe("k.compiler: routes.json beside a routes.ts (W1005)", () => {
  it("a genuine routes.json built from routes.ts is exactly one W1005 at .keel/routes.json and no E1005 (exit 0)", () => {
    expect(genuine).toContain("/home");
    const r = runCheck(proj);
    expect(diags(r.records, "E1005")).toEqual([]);
    expect(paths(diags(r.records, "W1005"))).toEqual([".keel/routes.json"]);
    expect(String(diags(r.records, "W1005")[0]?.message)).toContain("not verified");
    // W1005 is a warning: no error on a `.keel/` file (the fixture app has unrelated E1751/E1805).
    expect(keelErrors(r.records)).toEqual([]);
  }, 120_000);

  it("a forged self-consistent routes.json beside a routes.ts is W1005 in keel check, not E1005 (exit 0)", () => {
    const f = compile(sources, { routes: { r: ENTRY } });
    const text = artifactText(f.artifacts["routes.json"], f.hashes["routes.json"]);
    expect(text).not.toBe(genuine);
    writeRoutes(text);
    const r = runCheck(proj);
    expect(diags(r.records, "E1005")).toEqual([]);
    expect(paths(diags(r.records, "W1005"))).toEqual([".keel/routes.json"]);
    // W1005 is a warning: no error on a `.keel/` file (the fixture app has unrelated E1751/E1805).
    expect(keelErrors(r.records)).toEqual([]);
  }, 120_000);

  it("vite build over the forged routes.json warns W1005 naming .keel/routes.json and rewrites the genuine content", async () => {
    const warnings = await build();
    const hit = warnings.filter((m) => m.includes("W1005"));
    expect(hit).toHaveLength(1);
    expect(hit[0]).toContain(".keel/routes.json");
    expect(fs.readFileSync(routesFile(), "utf8")).toBe(genuine);
  }, 120_000);

  it("vite build over the genuine routes.json emits no W1005", async () => {
    expect((await build()).filter((m) => m.includes("W1005"))).toEqual([]);
    expect(fs.readFileSync(routesFile(), "utf8")).toBe(genuine);
  }, 120_000);

  it("a routes.json beside a routes.ts that is not self-consistent (data changed, hash kept) is still E1005", () => {
    const parsed: unknown = JSON.parse(genuine);
    const hash =
      typeof parsed === "object" && parsed !== null && "hash" in parsed && typeof parsed.hash === "string"
        ? parsed.hash
        : "";
    expect(hash).not.toBe("");
    const f = compile(sources, { routes: { r: ENTRY } });
    try {
      writeRoutes(artifactText(f.artifacts["routes.json"], hash));
      const r = runCheck(proj);
      expect(paths(diags(r.records, "E1005"))).toEqual([".keel/routes.json"]);
      expect(r.status).toBe(1);
    } finally {
      writeRoutes(genuine);
    }
  }, 120_000);
});
