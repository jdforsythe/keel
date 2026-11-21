// rfc:0160 conformance: a spread, a computed key or a repeated key in a deployable is E1552 in `keel check` and `keel build`, and nothing is emitted that holds the origin written there.
// Spec: k.topology, Rules "E1552 `topology.ts` not statically readable (a spread, computed key or key twice in a deployable too), a name not `[a-z][a-z0-9-]*`, a module unknown or in two deployables."
// Spec: k.origins, Policy "All read the static read's declaration: the entries pass it as `createApp({ origins })`."
// Seed 1337 (no generated input: one fixture per form, spawned binary).
// The build stops at E1552, so no `server.mjs`, `csp.txt`, shell policy or `security.json` is written; the test reads every file the command left outside the sources and finds the origin in none.
// The served header of a runtime-only origin is packages/server/conformance/origins-own-frame-and-one-source.test.ts.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { cleanup, keel, materialize } from "./compat-support.ts";
import { SLOW, tree } from "./origins-support.ts";

const EVIL = "https://evil.example";
const SPREAD = `{ web: { modules: ['a'], adapter: 'node', ...{ origins: { connect: { '${EVIL}': 'x' } } } } }`;
const TWICE = `{ web: { modules: ['a'], adapter: 'node', origins: {}, origins: { connect: { '${EVIL}': 'x' } } } }`;
const COMPUTED = `{ ['web']: { modules: ['a'], adapter: 'node', origins: { connect: { '${EVIL}': 'x' } } } }`;
const DEPLOYABLE_TWICE = `{ web: { modules: ['a'], adapter: 'node' }, web: { modules: ['c'], adapter: 'node', origins: { connect: { '${EVIL}': 'x' } } } }`;

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) cleanup(d);
});

/** Every file under `dir` outside `node_modules` and the project's own sources (`topology.ts`, `modules/`, config). */
function emitted(dir: string, rel = ""): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(dir, rel))) {
    const path = rel === "" ? name : `${rel}/${name}`;
    if (name === "node_modules") continue;
    if (statSync(join(dir, path)).isDirectory()) {
      if (rel === "" && name === "modules") continue;
      out.push(...emitted(dir, path));
    } else if (!["topology.ts", "package.json", "tsconfig.json", "vite.config.ts"].includes(path)) out.push(path);
  }
  return out;
}

function expectOneE1552(topology: string, message: RegExp): void {
  const dir = materialize(tree(topology));
  dirs.push(dir);
  for (const command of ["check", "build"]) {
    const run = keel(dir, [command]);
    const found = run.records.filter((r) => r.kind === "diag" && r.code === "E1552");
    expect(found, command).toHaveLength(1);
    expect(String(found[0]?.message), command).toMatch(message);
    expect(found[0]?.path, command).toBe("topology.ts");
    expect(run.status, command).toBe(1);
  }
  for (const file of emitted(dir)) {
    expect(readFileSync(join(dir, file), "utf8"), file).not.toContain("evil.example");
  }
  expect(emitted(dir).filter((f) => /server\.mjs$|csp\.txt$|security\.json$|tauri\.conf\.json$/.test(f))).toEqual([]);
}

describe("rfc:0160 conformance: one declaration from the static read", () => {
  test(
    "rfc:0160 conformance: `web: { modules: ['a'], adapter: 'node', ...{ origins: { connect: { 'https://evil.example': 'x' } } } }` is one E1552 in `keel check` and in `keel build`, and no emitted file holds `https://evil.example`",
    () => expectOneE1552(SPREAD, /spread|computed/),
    SLOW,
  );
  test(
    "rfc:0160 conformance: a deployable with `origins` written twice, the second holding `https://evil.example` under `connect`, is one E1552 in `keel check` and in `keel build`, and no emitted file holds it",
    () => expectOneE1552(TWICE, /origins/),
    SLOW,
  );
  test(
    "rfc:0160 conformance: a computed key in a deployable is one E1552 in `keel check` and in `keel build`",
    () => expectOneE1552(COMPUTED, /./),
    SLOW,
  );
  test(
    "rfc:0160 conformance: a repeated deployable name is one E1552 in `keel check` and in `keel build`, and no emitted file holds the origin of the second",
    () => expectOneE1552(DEPLOYABLE_TWICE, /twice/),
    SLOW,
  );
});
