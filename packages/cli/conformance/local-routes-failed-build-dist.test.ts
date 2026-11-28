// Spec: k.api, clause "With `node` deployables `p` serving module `a` and `q` serving `b`, and module `c` served by none, after a `keel build` that succeeds, one that fails with E1510 on an entry of `a` leaves no `dist/p/` and `dist/q/` byte-identical, one that fails on an entry of `b` no `dist/q/` and `dist/p/` byte-identical, and one that fails on an entry of `c` both byte-identical."
// Seed: n/a (the forms and folders are the whole space).
// Method: compat-support.ts's `keel` over a temp project (`materialize`) with the config files of static-support.ts's `staticTree`; node deployables `p` serving module `a` and `q` serving module `b`; module `c` in `modules/c/` is in no deployable's `modules`.
// Each module holds the page `<id>.tools` with `local: true`; a successful build writes `dist/p/` and `dist/q/`, then one contract is changed to `local: !0` (E1510) and the build runs again; every file under each `dist/<name>/` is read before and after.
// ASSUMED: "byte-identical" is every file of `dist/<name>/` present with the same bytes; a build failing on an entry of module `c` reports E1510 for it though no deployable serves it.
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fixedTime } from "@keel/tooling/test-time";
import { afterAll, describe, expect, it } from "vitest";
import { type Tree, cleanup, diags, keel, materialize } from "./compat-support.ts";
import { staticTree } from "./static-support.ts";

const made: string[] = [];
afterAll(() => {
  for (const d of made) cleanup(d);
});

const contractOf = (id: string, local: string): string =>
  `import { contract } from '@keel/router/contract'\nexport const ${id} = contract('${id}', { '${id}.tools': { path: '/${id}', local: ${local} } })\n`;
const moduleFiles = (id: string): Tree => ({
  [`modules/${id}/module.ts`]: `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [] } })\n`,
  [`modules/${id}/${id}.contract.ts`]: contractOf(id, "true"),
  [`modules/${id}/Tools.tsx`]: `import { Box, Text } from '@keel/ui'\nexport default function Tools() {\n  return <Box id="${id}.tools"><Text id="${id}.tools.text">tools</Text></Box>\n}\n`,
  [`modules/${id}/routes.ts`]: `import { manifest } from '@keel/router'\nimport { ${id} } from './${id}.contract.ts'\nimport Tools from './Tools.tsx'\nexport const routes = manifest(${id}, { '${id}.tools': { component: Tools } })\n`,
});
const project = (): string => {
  const base = staticTree();
  const dir = materialize({
    "package.json": base["package.json"] ?? "",
    "vite.config.ts": base["vite.config.ts"] ?? "",
    "tsconfig.json": base["tsconfig.json"] ?? "",
    "topology.ts":
      "import { topology } from '@keel/server'\nexport default topology({ p: { modules: ['a'], adapter: 'node' }, q: { modules: ['b'], adapter: 'node' } })\n",
    ...moduleFiles("a"),
    ...moduleFiles("b"),
    ...moduleFiles("c"),
  });
  made.push(dir);
  return dir;
};
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)).map((f) => join(e.name, f)) : [e.name],
  );
/** Every file under `dist/<name>/` with its bytes (base64), or `undefined` where the folder is absent. */
const snapshot = (dir: string, name: string): Record<string, string> | undefined => {
  const d = join(dir, "dist", name);
  if (!existsSync(d)) return undefined;
  const out: Record<string, string> = {};
  for (const f of files(d).sort()) out[f] = readFileSync(join(d, f)).toString("base64");
  return out;
};
const broken = (dir: string, id: string): void =>
  writeFileSync(join(dir, `modules/${id}/${id}.contract.ts`), contractOf(id, "!0"));

describe("k.api Rules: a failed build removes the `dist/<name>/` of the deployables serving the failing entry, and no other", () => {
  it(
    "a `keel build` failing with E1510 on an entry of a module no deployable serves removes no `dist/<name>/`",
    () => {
      const dir = project();
      const first = keel(dir, ["build"]);
      expect(first.status, JSON.stringify(first.records.slice(-3))).toBe(0);
      const [p, q] = [snapshot(dir, "p"), snapshot(dir, "q")];
      expect(p).toBeDefined();
      expect(q).toBeDefined();
      broken(dir, "c");
      const r = keel(dir, ["build"]);
      expect(diags(r, "E1510")).toHaveLength(1);
      expect(r.status).toBe(1);
      expect(snapshot(dir, "p")).toEqual(p);
      expect(snapshot(dir, "q")).toEqual(q);
    },
    fixedTime(900_000),
  );

  it(
    "a `keel build` failing with E1510 on an entry of a module one deployable serves removes that one `dist/<name>/` alone, the others byte-identical",
    () => {
      for (const [failing, removed, kept] of [
        ["a", "p", "q"],
        ["b", "q", "p"],
      ] as const) {
        const dir = project();
        const first = keel(dir, ["build"]);
        expect(first.status, JSON.stringify(first.records.slice(-3))).toBe(0);
        const before = snapshot(dir, kept);
        expect(before, kept).toBeDefined();
        expect(snapshot(dir, removed), removed).toBeDefined();
        broken(dir, failing);
        const r = keel(dir, ["build"]);
        expect(diags(r, "E1510"), failing).toHaveLength(1);
        expect(r.status, failing).toBe(1);
        expect(existsSync(join(dir, "dist", removed)), removed).toBe(false);
        expect(snapshot(dir, kept), kept).toEqual(before);
      }
    },
    fixedTime(1_800_000),
  );
});
