// Spec: k.cli, clause "An MCP `build` writes the `.keel/` files `keel build` writes."
// k.cli (rfc:0092)
// Also the rfc:0092 B2 sentence: an MCP `build` and `keel build` on one fixture write equal `routes.json` and `surface.json`.
// Seed 1337 (the one generated input, the fixture's field name). Drives the real binary: `keel build` in one temp project,
// `keel mcp` with one `tools/call` of `build` in a second temp project of the same files; the trees are compared.
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import fc from "fast-check";
import { afterAll, expect, test } from "vitest";
import { SEED, cleanup, keel, materialize, project } from "./compat-support.ts";

const BIN = resolve(dirname(fileURLToPath(import.meta.url)), "..", "src", "bin.ts");
const SLOW = 120_000;

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) cleanup(d);
});

/** Every file under `dir` except `node_modules` and `dist`, by relative path, whose base name is in `names`, or under `.keel/`. */
function collect(dir: string, names: readonly string[]): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (d: string): void => {
    for (const e of readdirSync(d)) {
      if (e === "node_modules" || e === "dist") continue;
      const full = join(d, e);
      if (statSync(full).isDirectory()) walk(full);
      else {
        const rel = relative(dir, full);
        if (rel.startsWith(".keel/") || names.includes(e)) out.set(rel, readFileSync(full, "utf8"));
      }
    }
  };
  walk(dir);
  return out;
}

function mcpBuild(cwd: string): void {
  const env: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith("VITEST") || k === "NODE_OPTIONS" || k === "TEST") continue;
    env[k] = v;
  }
  const request = { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "build", arguments: {} } };
  const r = spawnSync(process.execPath, [BIN, "mcp"], {
    cwd,
    encoding: "utf8",
    env,
    input: `${JSON.stringify(request)}\n`,
  });
  expect(r.stdout.split("\n").find((l) => l.trim() !== "")).toBeDefined();
}

test(
  "An MCP `build` writes the `.keel/` files `keel build` writes.",
  () => {
    fc.assert(
      fc.property(fc.constantFrom("name", "note", "qty"), (f) => {
        const files = project({ body: `s.object({ ${f}: s.string() })`, split: true });
        const viaCli = materialize(files);
        const viaMcp = materialize(files);
        dirs.push(viaCli, viaMcp);

        expect(keel(viaCli, ["build"]).status).toBe(0);
        mcpBuild(viaMcp);

        const names = ["routes.json", "surface.json"] as const;
        const a = collect(viaCli, names);
        const b = collect(viaMcp, names);
        expect([...a.keys()].some((k) => k.endsWith("surface.json"))).toBe(true);
        expect([...b.keys()].sort()).toEqual([...a.keys()].sort());
        for (const [path, text] of a) expect(b.get(path), path).toBe(text);
      }),
      { seed: SEED, numRuns: 2 },
    );
  },
  SLOW,
);
