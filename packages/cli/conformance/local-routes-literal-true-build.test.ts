// Spec: k.contract, clause "In a fixture whose `node` deployable `api` serves module `a`, `local: !0`, `local: on` with `const on = true`, and `local: flag ? true : true` on page `a.tools` are each one E1510 at `local` in `keel check` and in `keel build`; after a `keel build` that succeeds, one that then fails with that E1510 leaves no `dist/api/`, and one that fails with the E1511 above no `dist/web/`."
// Rule text (not a Conformance bullet, so not a citation): E1510: k.contract; for a `local` member other than the literal `true` (`!0`, a name bound to `true`, a conditional), at that member in `keel check` and `keel build`. A `keel build` that fails with E1511 or E1510 leaves no `dist/<name>/` of the deployable serving the entry: not one an earlier build wrote, nor one this run wrote in part. (k.api Rules)
// This file covers the real `keel build` and `keel check` binary halves and the `dist/` halves (the in-memory `check()` half is packages/check's local-routes-literal-true.test.ts). Seed: n/a (the three forms and two directories are the whole space).
// Method: compat-support.ts's `keel` over a temp project (`materialize`), the config files of static-support.ts's `staticTree`, module `a` with the page `a.tools`; deployable `api` (`node`) for E1510, `web` for E1511.
// ASSUMED: (1) "at `local`" is the record's `path` being the contract file; (2) "this run wrote in part" cannot be forced from outside, so a part-written `dist/<name>/` (files with no earlier successful build) stands for it: the failing build leaves no such directory.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
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

const tree = (name: string, adapter: "client" | "static" | "node", local: string): Tree => {
  const base = staticTree();
  return {
    "package.json": base["package.json"] ?? "",
    "vite.config.ts": base["vite.config.ts"] ?? "",
    "tsconfig.json": base["tsconfig.json"] ?? "",
    "topology.ts": `import { topology } from '@keel/server'\nexport default topology({ ${name}: { modules: ['a'], adapter: '${adapter}' } })\n`,
    "modules/a/module.ts":
      "import { module } from '@keel/compiler'\nexport default module({ id: 'a', deps: [], capabilities: [], public: { exports: [] } })\n",
    "modules/a/a.contract.ts": `import { contract } from '@keel/router/contract'\nconst on = true\nconst flag: boolean = JSON.parse('true')\nexport const a = contract('a', { 'a.tools': { path: '/tools', local: ${local} } })\n`,
    "modules/a/Tools.tsx":
      'import { Box, Text } from \'@keel/ui\'\nexport default function Tools() {\n  return <Box id="a.tools"><Text id="a.tools.text">tools</Text></Box>\n}\n',
    "modules/a/routes.ts":
      "import { manifest } from '@keel/router'\nimport { a } from './a.contract.ts'\nimport Tools from './Tools.tsx'\nexport const routes = manifest(a, { 'a.tools': { component: Tools } })\n",
  };
};
const project = (name: string, adapter: "client" | "static" | "node", local: string): string => {
  const dir = materialize(tree(name, adapter, local));
  made.push(dir);
  return dir;
};
const FORMS = ["!0", "on", "flag ? true : true"];

describe("k.contract Local routes: `local` other than the literal `true` is E1510", () => {
  for (const expr of FORMS) {
    it(
      `\`local: ${expr}\` on page \`a.tools\` of module \`a\` served by the \`node\` deployable \`api\` is one E1510 at \`local\` in \`keel check\``,
      () => {
        const d = diags(keel(project("api", "node", expr), ["check"]), "E1510");
        expect(d).toHaveLength(1);
        expect(String(d[0]?.path)).toBe("modules/a/a.contract.ts");
      },
      SLOW,
    );

    it(
      `\`local: ${expr}\` on page \`a.tools\` of module \`a\` served by the \`node\` deployable \`api\` is one E1510 at \`local\` in \`keel build\`, which exits 1`,
      () => {
        const r = keel(project("api", "node", expr), ["build"]);
        const d = diags(r, "E1510");
        expect(d).toHaveLength(1);
        expect(String(d[0]?.path)).toBe("modules/a/a.contract.ts");
        expect(r.status).toBe(1);
      },
      SLOW,
    );
  }

  it(
    "after a `keel build` that succeeds, one that then fails with that E1510 leaves no `dist/api/`",
    () => {
      for (const expr of FORMS) {
        const dir = project("api", "node", "true");
        const first = keel(dir, ["build"]);
        expect(first.status, JSON.stringify(first.records.slice(-3))).toBe(0);
        expect(existsSync(join(dir, "dist", "api")), expr).toBe(true);
        writeFileSync(join(dir, "modules/a/a.contract.ts"), tree("api", "node", expr)["modules/a/a.contract.ts"] ?? "");
        const r = keel(dir, ["build"]);
        expect(diags(r, "E1510"), expr).toHaveLength(1);
        expect(r.status, expr).toBe(1);
        expect(existsSync(join(dir, "dist", "api")), expr).toBe(false);
      }
    },
    fixedTime(900_000),
  );

  it(
    "a part-written `dist/api/` left where no build succeeded is gone after a `keel build` that fails with that E1510",
    () => {
      for (const expr of FORMS) {
        const dir = project("api", "node", expr);
        mkdirSync(join(dir, "dist", "api", "client"), { recursive: true });
        writeFileSync(join(dir, "dist", "api", "client", "partial.js"), "// part of a build\n");
        const r = keel(dir, ["build"]);
        expect(diags(r, "E1510"), expr).toHaveLength(1);
        expect(r.status, expr).toBe(1);
        expect(existsSync(join(dir, "dist", "api")), expr).toBe(false);
      }
    },
    fixedTime(600_000),
  );

  it(
    "after a `keel build` that succeeds, one that then fails with the E1511 above leaves no `dist/web/`",
    () => {
      const dir = project("web", "node", "true");
      const first = keel(dir, ["build"]);
      expect(first.status, JSON.stringify(first.records.slice(-3))).toBe(0);
      expect(existsSync(join(dir, "dist", "web"))).toBe(true);
      writeFileSync(join(dir, "topology.ts"), tree("web", "client", "true")["topology.ts"] ?? "");
      const r = keel(dir, ["build"]);
      expect(diags(r, "E1511")).toHaveLength(1);
      expect(r.status).toBe(1);
      expect(existsSync(join(dir, "dist", "web"))).toBe(false);
    },
    SLOW,
  );

  it(
    "a part-written `dist/web/` left where no build succeeded is gone after a `keel build` that fails with the E1511 above",
    () => {
      const dir = project("web", "client", "true");
      mkdirSync(join(dir, "dist", "web", "assets"), { recursive: true });
      writeFileSync(join(dir, "dist", "web", "assets", "partial.js"), "// part of a build\n");
      const r = keel(dir, ["build"]);
      expect(diags(r, "E1511")).toHaveLength(1);
      expect(r.status).toBe(1);
      expect(existsSync(join(dir, "dist", "web"))).toBe(false);
    },
    SLOW,
  );
});
