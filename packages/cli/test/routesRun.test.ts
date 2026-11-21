// rfc:0059 (backlog 0150): keel build writes routes.json when every deployable is node.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { repoRoot } from "@keel/tooling/repo-root";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { routesRun } from "../src/internal/routesRun.ts";

const repo = repoRoot(import.meta.dirname);
const ROUTES_TS = `import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
const m = contract("m", { "m.home": { path: "/home" } });
export const routes = manifest(m, {
  "m.home": { component: () => null },
});
`;
const NODE_TOP = 'export default topology({ api: { modules: ["m"], adapter: "node" } });\n';
const CLIENT_TOP = 'export default topology({ web: { modules: ["m"], adapter: "client" } });\n';

const dirs: string[] = [];
function makeProject(routesTs: string): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "keel-routes-run-")));
  dirs.push(dir);
  fs.mkdirSync(path.join(dir, "modules", "m"), { recursive: true });
  fs.writeFileSync(path.join(dir, "modules", "m", "routes.ts"), routesTs);
  fs.mkdirSync(path.join(dir, "node_modules/@keel"), { recursive: true });
  for (const pkg of fs.readdirSync(path.join(repo, "packages"))) {
    fs.symlinkSync(path.join(repo, "packages", pkg), path.join(dir, "node_modules/@keel", pkg));
  }
  for (const name of ["vitest", "vite", "typescript"]) {
    fs.symlinkSync(path.join(repo, "node_modules", name), path.join(dir, "node_modules", name));
  }
  return dir;
}

afterAll(() => {
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
});

describe("routesRun", () => {
  let proj = "";
  beforeAll(() => {
    proj = makeProject(ROUTES_TS);
  });
  const file = (): string => path.join(proj, ".keel", "routes.json");

  it("no topology is a no-op and writes nothing", async () => {
    expect(await routesRun(proj, undefined)).toEqual({ code: 0, notes: [] });
    expect(fs.existsSync(file())).toBe(false);
  });

  it("a topology with a client deployable is a no-op", async () => {
    expect(await routesRun(proj, CLIENT_TOP)).toEqual({ code: 0, notes: [] });
    expect(fs.existsSync(file())).toBe(false);
  });

  it("an all-node topology writes .keel/routes.json, then rewrites a forged one with a W1005 note", async () => {
    expect(await routesRun(proj, NODE_TOP)).toEqual({ code: 0, notes: [] });
    const genuine = fs.readFileSync(file(), "utf8");
    expect(genuine).toContain("/home");

    fs.chmodSync(file(), 0o644);
    fs.writeFileSync(file(), genuine.replace("/home", "/forged"));
    const again = await routesRun(proj, NODE_TOP);
    expect(again.code).toBe(0);
    expect(again.notes.some((n) => n.startsWith("W1005 .keel/routes.json differed"))).toBe(true);
    expect(fs.readFileSync(file(), "utf8")).toBe(genuine);
  }, 60_000);

  it("a routes.ts with a syntax error does not throw: code 1 or a Keel-coded note", async () => {
    const bad = makeProject("export const routes = manifest({ \n");
    const r = await routesRun(bad, NODE_TOP);
    expect(r.code === 1 || r.notes.some((n) => /E10(00|06)/.test(n))).toBe(true);
  }, 60_000);
});
