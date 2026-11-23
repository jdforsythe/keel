// Spec: k.shell, Conformance "With a stub target whose `plugins` gives `{ plugin: '@x/p', version: '1.2.3', need: 'n' }`: `keel check` of an app without `@x/p` in `dependencies` prints one E1572 at the deployable's key naming `@x/p 1.2.3` and `(n)`, whose fix adds `\"@x/p\": \"1.2.3\"`; with `\"@x/p\": \"^1.2.3\"`, one whose fix sets `1.2.3`; with `1.2.3`, none. Two `client` deployables declaring the shell: one E1572."
// Spec: k.shell, Conformance "With that E1572, `keel build --target tauri` prints it, exits 1, writes nothing under `dist/web/tauri/` and calls no `build`."
// Spec: k.shell, Conformance "A stub whose `plugins` gives that entry only when `app.identity`: no E1572 in a project with no `identity.ts`; one with it."
// Spec: k.shell, Plugins "`<deployable>: <shell> needs <plugin> <version> in package.json dependencies (<need>)`, its fix that entry added or set, keys sorted; once per plugin in a project. No `package.json`, or one that is not a JSON object: none."
// Seed: 1337 (the plugin name, version and need are generated; the projects are otherwise fixed).
// Over a stub `@keel/std-tauri` (`shell-stub.ts`, `plugins` in its config). ASSUMPTIONS: the diag's `message` is the quoted text and its `fix` a unified diff of `package.json` (as E1572 over `check()`),
// with `path` naming `topology.ts`; "at the deployable's key" is read as the message starting `web:`.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { SEED, SLOW, buildCalls, cleanup, run, setStub, stubProject, withCode } from "./shell-stub.ts";

let dir = "";
let original = "";
beforeAll(() => {
  dir = stubProject();
  original = readFileSync(join(dir, "topology.ts"), "utf8");
}, SLOW);
afterAll(() => cleanup(dir));

const lower = fc.stringMatching(/^[a-z]{2,8}$/);
const plugin = fc.tuple(lower, lower).map(([a, b]) => `@${a}/${b}`);
const version = fc.tuple(fc.nat(30), fc.nat(30), fc.nat(30)).map(([a, b, c]) => `${a}.${b}.${c}`);
const need = fc.stringMatching(/^[a-z][a-z ]{0,38}$/);
const setDeps = (deps: Record<string, string>, root = dir): void => {
  writeFileSync(
    join(root, "package.json"),
    `${JSON.stringify({ name: "fx", private: true, type: "module", version: "1.0.0", dependencies: { "@keel/std-tauri": "workspace:*", ...deps } }, null, 2)}\n`,
  );
};
const e1572 = (args: readonly string[]) => withCode(run(dir, args), "E1572");

const IDENTITY = {
  "identity.ts": "import { identityMount } from '@keel/router'\nexport default identityMount('/api/auth')\n",
  "identity.server.ts":
    "import { identity } from '@keel/server'\nimport mount from './identity.ts'\nexport default identity({ identify: async () => '', handle: { path: mount.path, fn: () => new Response('') } })\n",
};
const WITH_IDENTITY =
  "import { topology } from '@keel/server'\nexport default topology({\n  web: { modules: ['c'], adapter: 'client', servedBy: 'api', shells: { tauri: { id: 'dev.keel.golden', name: 'Golden' } } },\n  api: { modules: [], adapter: 'node' },\n})\n";
const TWO_CLIENTS =
  "import { topology } from '@keel/server'\nexport default topology({\n  web: { modules: ['c'], adapter: 'client', shells: { tauri: { id: 'dev.keel.golden', name: 'Golden' } } },\n  web2: { modules: ['c'], adapter: 'client', shells: { tauri: { id: 'dev.keel.golden2', name: 'Golden2' } } },\n})\n";

describe("k.shell: Plugins over a stub package", () => {
  test(
    "`keel check` of an app without the plugin in `dependencies` prints one E1572 at the deployable's key naming `<plugin> <version>` and `(<need>)`, whose fix adds it",
    () => {
      fc.assert(
        fc.property(plugin, version, need, (p, v, n) => {
          setStub(dir, { plugins: [{ plugin: p, version: v, need: n }] });
          setDeps({});
          const found = e1572(["check"]);
          expect(found).toHaveLength(1);
          const diag = found[0];
          expect(diag?.message).toBe(`web: tauri needs ${p} ${v} in package.json dependencies (${n})`);
          expect(String(diag?.path)).toContain("topology.ts");
          expect(String(diag?.fix)).toContain(`+    "${p}": "${v}"`);
        }),
        { seed: SEED, numRuns: 6 },
      );
    },
    SLOW,
  );

  test(
    "with the plugin at `^<version>` one E1572 whose fix sets `<version>`; with `<version>` none",
    () => {
      fc.assert(
        fc.property(plugin, version, (p, v) => {
          setStub(dir, { plugins: [{ plugin: p, version: v, need: "n" }] });
          setDeps({ [p]: `^${v}` });
          const found = e1572(["check"]);
          expect(found).toHaveLength(1);
          expect(String(found[0]?.fix)).toContain(`-    "${p}": "^${v}"`);
          expect(String(found[0]?.fix)).toContain(`+    "${p}": "${v}"`);
          setDeps({ [p]: v });
          expect(e1572(["check"])).toEqual([]);
        }),
        { seed: SEED, numRuns: 4 },
      );
    },
    SLOW,
  );

  test(
    "two `client` deployables declaring the shell give one E1572",
    () => {
      setStub(dir, { plugins: [{ plugin: "@x/p", version: "1.2.3", need: "n" }] });
      setDeps({});
      writeFileSync(join(dir, "topology.ts"), TWO_CLIENTS);
      try {
        expect(e1572(["check"])).toHaveLength(1);
      } finally {
        writeFileSync(join(dir, "topology.ts"), original);
      }
    },
    SLOW,
  );

  test(
    "`keel build --target tauri` with that E1572 prints it, exits 1, writes nothing under `dist/web/tauri/` and calls no `build`",
    () => {
      setStub(dir, { plugins: [{ plugin: "@x/p", version: "1.2.3", need: "n" }] });
      setDeps({});
      const r = run(dir, ["build", "--target", "tauri"]);
      expect(r.status).toBe(1);
      const found = withCode(r, "E1572");
      expect(found).toHaveLength(1);
      expect(found[0]?.message).toBe("web: tauri needs @x/p 1.2.3 in package.json dependencies (n)");
      expect(existsSync(join(dir, "dist", "web", "tauri"))).toBe(false);
      expect(buildCalls(dir)).toEqual([]);
    },
    SLOW,
  );

  test(
    "`keel build --target tauri` with the plugin listed at its version reports no E1572",
    () => {
      setStub(dir, { plugins: [{ plugin: "@x/p", version: "1.2.3", need: "n" }] });
      setDeps({ "@x/p": "1.2.3" });
      expect(withCode(run(dir, ["build", "--target", "tauri"]), "E1572")).toEqual([]);
    },
    SLOW,
  );

  test(
    "a plugin given only when `app.identity` is no E1572 in a project with no `identity.ts`, and one with it",
    () => {
      setStub(dir, { plugins: [{ plugin: "@x/p", version: "1.2.3", need: "n", whenIdentity: true }] });
      setDeps({});
      expect(e1572(["check"])).toEqual([]);
      writeFileSync(join(dir, "topology.ts"), WITH_IDENTITY);
      for (const [path, source] of Object.entries(IDENTITY)) writeFileSync(join(dir, path), source);
      const found = e1572(["check"]);
      expect(found).toHaveLength(1);
      expect(found[0]?.message).toBe("web: tauri needs @x/p 1.2.3 in package.json dependencies (n)");
    },
    SLOW,
  );
});
