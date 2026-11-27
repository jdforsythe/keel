// Spec: k.contract, clause "In a fixture whose `client` deployable `web` serves module `a` with a `local: true` page `a.tools`, `keel check` and `keel build` each report one E1511 `a.tools: local route in client deployable web, which has no server` at `topology.ts`, `keel build` exits 1 and writes no `dist/web/`, and `createApp` for `web` throws E1511; with `web` a `static` deployable, one E1511 `a.tools: local route in static deployable web, which has no server`; with `a` served by a `node` deployable, none."
// Spec: k.api Rules: "E1511 an API entry, or a `local: true` entry (k.contract Local routes), in a module a `client` or `static` deployable serves (k.topology); reported from `topology.ts` at the module's id by `keel check` and `keel build` (which then fails and writes no `dist/<name>/`), thrown by `createApp`; message `<id>: API route in <adapter> deployable <name>, which has no server`, for a `local` page `<id>: local route in <adapter> deployable <name>, which has no server`; no fix: the remedy, serving the module from a `node` deployable, is `keel explain`'s."
// This file covers the real `keel build` and `keel check` binary halves (the in-memory `check()` half is packages/check, `createApp` is packages/server). Seed: n/a (no generated input).
// Method: compat-support.ts's `keel` over a temp project (`materialize`), the config files of static-support.ts's `staticTree`, module `a` with the `local: true` page `a.tools`.
// ASSUMED: "at `topology.ts`" is the record's `path`; `dist/web/` is looked for under the project folder.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fixedTime } from "@keel/tooling/test-time";
import { afterAll, describe, expect, it } from "vitest";
import { type Tree, cleanup, diags, keel, materialize } from "./compat-support.ts";
import { staticTree } from "./static-support.ts";

const made: string[] = [];
afterAll(() => {
  for (const d of made) cleanup(d);
});
const SLOW = fixedTime(300_000);

const tree = (adapter: "client" | "static" | "node"): Tree => {
  const base = staticTree();
  return {
    "package.json": base["package.json"] ?? "",
    "vite.config.ts": base["vite.config.ts"] ?? "",
    "tsconfig.json": base["tsconfig.json"] ?? "",
    "topology.ts": `import { topology } from '@keel/server'\nexport default topology({ web: { modules: ['a'], adapter: '${adapter}' } })\n`,
    "modules/a/module.ts":
      "import { module } from '@keel/compiler'\nexport default module({ id: 'a', deps: [], capabilities: [], public: { exports: [] } })\n",
    "modules/a/a.contract.ts":
      "import { contract } from '@keel/router/contract'\nexport const a = contract('a', { 'a.tools': { path: '/tools', local: true } })\n",
    "modules/a/Tools.tsx":
      'import { Box, Text } from \'@keel/ui\'\nexport default function Tools() {\n  return <Box id="a.tools"><Text id="a.tools.text">tools</Text></Box>\n}\n',
    "modules/a/routes.ts":
      "import { manifest } from '@keel/router'\nimport { a } from './a.contract.ts'\nimport Tools from './Tools.tsx'\nexport const routes = manifest(a, { 'a.tools': { component: Tools } })\n",
  };
};
const project = (adapter: "client" | "static" | "node"): string => {
  const dir = materialize(tree(adapter));
  made.push(dir);
  return dir;
};
const MSG = (adapter: string): string => `a.tools: local route in ${adapter} deployable web, which has no server`;

describe("k.contract Local routes: the CLI and a `local` route with no server", () => {
  it(
    "`keel check` reports one E1511 `a.tools: local route in client deployable web, which has no server` at `topology.ts`",
    () => {
      const r = keel(project("client"), ["check"]);
      const d = diags(r, "E1511");
      expect(d).toHaveLength(1);
      expect(d[0]?.message).toBe(MSG("client"));
      expect(String(d[0]?.path)).toBe("topology.ts");
    },
    SLOW,
  );

  it(
    "`keel build` reports one E1511 `a.tools: local route in client deployable web, which has no server` at `topology.ts`, exits 1 and writes no `dist/web/`",
    () => {
      const dir = project("client");
      const r = keel(dir, ["build"]);
      const d = diags(r, "E1511");
      expect(d).toHaveLength(1);
      expect(d[0]?.message).toBe(MSG("client"));
      expect(String(d[0]?.path)).toBe("topology.ts");
      expect(r.status).toBe(1);
      expect(existsSync(join(dir, "dist", "web"))).toBe(false);
    },
    SLOW,
  );

  it(
    "with `web` a `static` deployable, `keel check` reports one E1511 `a.tools: local route in static deployable web, which has no server`",
    () => {
      const d = diags(keel(project("static"), ["check"]), "E1511");
      expect(d).toHaveLength(1);
      expect(d[0]?.message).toBe(MSG("static"));
    },
    SLOW,
  );

  it(
    "with `web` a `static` deployable, `keel build` reports one E1511 `a.tools: local route in static deployable web, which has no server`, exits 1 and writes no `dist/web/`",
    () => {
      const dir = project("static");
      const r = keel(dir, ["build"]);
      const d = diags(r, "E1511");
      expect(d).toHaveLength(1);
      expect(d[0]?.message).toBe(MSG("static"));
      expect(r.status).toBe(1);
      expect(existsSync(join(dir, "dist", "web"))).toBe(false);
    },
    SLOW,
  );

  it(
    "with `a` served by a `node` deployable, `keel check` and `keel build` report no E1511",
    () => {
      const dir = project("node");
      expect(diags(keel(dir, ["check"]), "E1511")).toEqual([]);
      expect(diags(keel(dir, ["build"]), "E1511")).toEqual([]);
    },
    SLOW,
  );
});
