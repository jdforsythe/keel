// Spec: k.cli, clause "`keel check apps/a` at a workspace root and `keel check` in `apps/a` report the same diagnostics."
// Temp workspace: root topology is node `api` for "todos"; apps/a is client-only for "todos" and imports a *.server.ts from a module (E1004 only under the root's topology).
// No fast-check: fixed fixture; no seed.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const BIN = path.join(repo, "packages/cli/src/bin.ts");

const FILES: Record<string, string> = {
  "topology.ts": `export default { api: { modules: ["todos"], adapter: "node" } };\n`,
  "apps/a/topology.ts": `export default { web: { modules: ["todos"], adapter: "client" } };\n`,
  "apps/a/modules/todos/load.server.ts": "export const load = (): number => 1;\n",
  "apps/a/modules/todos/view.ts": `import { load } from "./load.server.ts";\nexport const view = (): number => load();\n`,
};

type Json = Record<string, unknown>;
const isJson = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

function run(cwd: string, args: string[]): { status: number | null; records: Json[] } {
  const env: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith("VITEST") || k === "NODE_OPTIONS" || k === "TEST") continue;
    env[k] = v;
  }
  const r = spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: "utf8", env });
  const records: Json[] = [];
  for (const line of r.stdout.split("\n")) {
    if (line.trim() === "") continue;
    try {
      const v: unknown = JSON.parse(line);
      if (isJson(v)) records.push(v);
    } catch {
      // non-JSON line: ignored
    }
  }
  return { status: r.status, records };
}

const strip = (p: unknown): string => String(p).replace(/^apps\/a\//, "");
const diagSet = (records: Json[]): string[] =>
  records
    .filter((r) => r.kind === "diag")
    .map((r) => JSON.stringify([r.code, strip(r.path), r.line, r.col, r.message]))
    .sort();
const filesCount = (records: Json[]): unknown => {
  const s = records.find((r) => r.kind === "summary");
  const counts = s?.counts;
  return isJson(counts) ? counts.files : undefined;
};

let ws = "";
beforeAll(() => {
  ws = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "keel-ws-same-")));
  for (const [rel, text] of Object.entries(FILES)) {
    fs.mkdirSync(path.dirname(path.join(ws, rel)), { recursive: true });
    fs.writeFileSync(path.join(ws, rel), text);
  }
});
afterAll(() => {
  fs.rmSync(ws, { recursive: true, force: true });
});

describe("k.cli: workspace check", () => {
  it("`keel check apps/a` at a workspace root and `keel check` in `apps/a` report the same diagnostics", () => {
    const fromRoot = run(ws, ["check", "apps/a", "--format=json"]);
    const inApp = run(path.join(ws, "apps/a"), ["check", "--format=json"]);
    expect(fromRoot.records.length).toBeGreaterThan(0);
    expect(diagSet(fromRoot.records)).toEqual(diagSet(inApp.records));
    expect(filesCount(fromRoot.records)).toBeDefined();
    expect(filesCount(fromRoot.records)).toEqual(filesCount(inApp.records));
  }, 120_000);

  it("neither run reports E1004, since the app's topology is client-only", () => {
    const fromRoot = run(ws, ["check", "apps/a", "--format=json"]);
    const inApp = run(path.join(ws, "apps/a"), ["check", "--format=json"]);
    for (const r of [fromRoot, inApp]) {
      expect(r.records.filter((x) => x.kind === "diag" && x.code === "E1004")).toEqual([]);
    }
  }, 120_000);
});
