// Spec: k.mount, Messages "E1580: `identity.ts's default export is not identityMount('<literal>') of lowercase / segments` (86 units) or `identity.server.ts gives no handle: { path: <identity.ts default import>.path }` (79). E1589: `<name> (static) serves no router, so with identity.ts its pages never learn the reader` (`site`: 84) or `<name> (client) has no servedBy: no origin of it mounts the identity handle` (`web`: 72). What to do instead is `keel explain`'s. E1589's fix, for a `client` deployable when `topology.ts` has exactly one `node` deployable, adds `servedBy: '<its name>'` to the entry; otherwise none."
// Spec: k.mount, Rules "... Fix: none, but E1589's below."
// Seed 1337 (the property). In-memory project, `check(files, { types: false })`.
// ASSUMPTION ("the exact diff"): a fix is a unified diff of `topology.ts` only, whose one removed line is the entry's line and whose one added line is that line with `servedBy: '<name>'` inserted in the entry; where in the entry the spec does not say, so the added line is compared with the removed one once `servedBy: '<name>'` and the punctuation and spaces around it are taken out.
import { check } from "@keel/check";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { type Files, SEED } from "./support.ts";

const f = (path: string, source: string): Files[number] => ({ path, source });
const MANIFEST = (id: string): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [] } })\n`;
const IDENTITY = `import { identityMount } from '@keel/router'\nexport default identityMount('/api/auth')\n`;
const SERVER = `import { identity } from '@keel/server'\nimport mount from './identity.ts'\nexport default identity({ identify: async () => '', handle: { path: mount.path, fn: () => new Response('') } })\n`;

const project = (deployables: readonly string[]): Files => [
  f(
    "topology.ts",
    `import { topology } from '@keel/server'\nexport default topology({\n${deployables.map((d) => `  ${d},`).join("\n")}\n})\n`,
  ),
  f("modules/a/module.ts", MANIFEST("a")),
  f("modules/b/module.ts", MANIFEST("b")),
  f("identity.ts", IDENTITY),
  f("identity.server.ts", SERVER),
];
const WEB = "web: { modules: ['a'], adapter: 'client' }";
const node = (name: string, mod = "b"): string => `${name}: { modules: ['${mod}'], adapter: 'node' }`;
const e1589 = (files: Files) => check(files, { types: false }).diagnostics.filter((d) => d.code === "E1589");

function applyFix(files: Files, fix: string): Files {
  const dir = mkdtempSync(join(tmpdir(), "keel-e1589-"));
  try {
    for (const x of files) {
      mkdirSync(dirname(join(dir, x.path)), { recursive: true });
      writeFileSync(join(dir, x.path), x.source);
    }
    writeFileSync(join(dir, "fix.patch"), `${fix}\n`);
    execFileSync("git", ["apply", "--unsafe-paths", "--directory=.", "fix.patch"], { cwd: dir, stdio: "pipe" });
    return files.map((x) => ({ path: x.path, source: readFileSync(join(dir, x.path), "utf8") }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const changed = (fix: string, sign: "-" | "+"): string[] =>
  fix.split("\n").filter((l) => l.startsWith(sign) && !l.startsWith(`${sign}${sign}${sign}`));
const bare = (s: string): string => s.replace(/[,\s]/g, "");

describe("k.mount: E1589's fix adds servedBy to a client deployable when topology.ts has exactly one node deployable", () => {
  test("`{ web: client, api: node }` is one E1589 whose fix edits `topology.ts` only, replacing `web`'s line by it with `servedBy: 'api'` added", () => {
    const files = project([WEB, node("api")]);
    const d = e1589(files);
    expect(d).toHaveLength(1);
    const fix = d[0]?.fix ?? "";
    expect(fix.startsWith("--- a/topology.ts\n+++ b/topology.ts\n")).toBe(true);
    expect(fix).not.toMatch(/^(---|\+\+\+) [ab]\/(?!topology\.ts$)/m);
    expect(changed(fix, "-")).toEqual([`-  ${WEB},`]);
    const added = changed(fix, "+");
    expect(added).toHaveLength(1);
    expect(added[0]).toContain("servedBy: 'api'");
    expect(bare((added[0] ?? "").replace("servedBy: 'api'", ""))).toBe(bare(`-  ${WEB},`).replace("-", "+"));
  });

  test("the fix applies with `git apply` and re-checking reports no E1589", () => {
    const files = project([WEB, node("api")]);
    const fix = e1589(files)[0]?.fix ?? "";
    const patched = applyFix(files, fix);
    expect(patched).not.toEqual(files);
    expect(patched.find((x) => x.path === "topology.ts")?.source).toContain("servedBy: 'api'");
    expect(e1589(patched)).toEqual([]);
  });

  test("whatever the `node` deployable is called, the fix adds `servedBy: '<its name>'`", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z][a-z0-9]{0,9}$/), (key) => {
        fc.pre(key !== "web");
        const files = project([WEB, node(key)]);
        const d = e1589(files);
        expect(d).toHaveLength(1);
        const patched = applyFix(files, d[0]?.fix ?? "");
        expect(patched.find((x) => x.path === "topology.ts")?.source).toContain(`servedBy: '${key}'`);
        expect(e1589(patched)).toEqual([]);
      }),
      { seed: SEED, numRuns: 15 },
    );
  });

  test("with no `node` deployable, `{ web: client }` is one E1589 and carries no fix", () => {
    const d = e1589(project([WEB]));
    expect(d).toHaveLength(1);
    expect(d[0]?.fix).toBeUndefined();
  });

  test("with two `node` deployables, `{ web: client, api: node, api2: node }` is one E1589 and carries no fix", () => {
    const d = e1589(project([WEB, node("api"), node("api2", "a")]));
    expect(d).toHaveLength(1);
    expect(d[0]?.fix).toBeUndefined();
  });

  test("a `static` deployable beside one `node` deployable is one E1589 and carries no fix", () => {
    const d = e1589(project(["site: { modules: ['a'], adapter: 'static' }", node("api")]));
    expect(d).toHaveLength(1);
    expect(d[0]?.fix).toBeUndefined();
  });
});
