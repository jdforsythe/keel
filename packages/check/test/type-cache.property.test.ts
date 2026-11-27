// Seed 1337. The type cache's law (k.check-cache): over generated edit sequences, a warm `check()` (this module's memo,
// and a fresh module reading the folder the earlier calls wrote) reports what a cold one (a fresh module, no folder)
// reports. The edits include the holes an mtime cache had: a file rewritten with its old time, a dependency's
// `package.json` `types` changed, a new file shadowing a resolution, and a linked package's target gaining one; and
// what one process carries between calls: the JSX runtime starting or stopping to resolve (other compiler options for
// files already parsed) and a `@keel/std-*` package leaving `deps` after a call imported it.
import { mkdirSync, realpathSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fixedTime } from "@keel/tooling/test-time";
import { tempDir } from "@keel/tooling/test-tmp";
import fc from "fast-check";
import { afterAll, expect, it, vi } from "vitest";
import { check } from "../src/index.ts";

const SEED = 1337;
const REPO = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const OLD = 1_700_000_000;
const bases: string[] = [];
afterAll(() => {
  for (const b of bases) rmSync(b, { recursive: true, force: true });
});

function put(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  utimesSync(path, OLD, OLD);
}
const DTS = (type: string): string => `export declare const n: ${type}\n`;

type Edit =
  | { k: "a"; type: string }
  | { k: "dts"; type: string }
  | { k: "other"; on: boolean }
  | { k: "types"; to: string }
  | { k: "shadow"; on: boolean }
  | { k: "linked"; on: boolean }
  | { k: "jsx"; on: boolean }
  | { k: "deps"; on: boolean };

const types = fc.constantFrom("number", "string");
const edit: fc.Arbitrary<Edit> = fc.oneof(
  types.map((type): Edit => ({ k: "a", type })),
  types.map((type): Edit => ({ k: "dts", type })),
  fc.boolean().map((on): Edit => ({ k: "other", on })),
  fc.constantFrom("index.d.ts", "other.d.ts").map((to): Edit => ({ k: "types", to })),
  fc.boolean().map((on): Edit => ({ k: "shadow", on })),
  fc.boolean().map((on): Edit => ({ k: "linked", on })),
  fc.boolean().map((on): Edit => ({ k: "jsx", on })),
  fc.boolean().map((on): Edit => ({ k: "deps", on })),
);

function project(): { root: string; foo: string; bar: string } {
  const base = realpathSync(tempDir("keel-type-law-"));
  bases.push(base);
  const root = join(base, "p");
  const foo = join(root, "node_modules/foo");
  mkdirSync(join(root, "node_modules/@keel"), { recursive: true });
  const bar = join(base, "bar");
  put(join(root, "package.json"), '{"name":"p","private":true,"type":"module"}\n');
  put(join(foo, "package.json"), '{"name":"foo","types":"index.d.ts"}\n');
  put(join(foo, "index.d.ts"), DTS("number"));
  put(join(foo, "sub.d.ts"), DTS("number"));
  put(join(bar, "package.json"), '{"name":"bar","types":"index.d.ts"}\n');
  put(join(bar, "x.d.ts"), DTS("number"));
  symlinkSync(bar, join(root, "node_modules/bar"));
  for (const p of ["schema", "std-temporal", "compiler"])
    symlinkSync(join(REPO, "packages", p), join(root, "node_modules/@keel", p));
  return { root, foo, bar };
}

function apply(p: { root: string; foo: string; bar: string }, e: Edit): void {
  const dom = join(p.root, "node_modules/@keel/runtime-dom");
  if (e.k === "jsx") {
    if (e.on) {
      put(join(dom, "package.json"), '{"name":"@keel/runtime-dom","exports":{"./jsx-runtime":{"types":"./j.d.ts"}}}');
      put(join(dom, "j.d.ts"), "export namespace JSX { interface IntrinsicElements { span: { bar?: 1 } } }\n");
    } else rmSync(dom, { recursive: true, force: true });
  }
  if (e.k === "dts") put(join(p.foo, "index.d.ts"), DTS(e.type));
  else if (e.k === "other") {
    if (e.on) put(join(p.foo, "other.d.ts"), DTS("string"));
    else rmSync(join(p.foo, "other.d.ts"), { force: true });
  } else if (e.k === "types") put(join(p.foo, "package.json"), `{"name":"foo","types":"${e.to}"}\n`);
  else if (e.k === "shadow") {
    if (e.on) put(join(p.foo, "sub.ts"), "export const n: string = 's'\n");
    else rmSync(join(p.foo, "sub.ts"), { force: true });
  } else if (e.k === "linked") {
    if (e.on) put(join(p.bar, "x.ts"), "export const n: string = 's'\n");
    else rmSync(join(p.bar, "x.ts"), { force: true });
  }
}

const MODULE = (deps: boolean) =>
  `import { module } from '@keel/compiler'\nexport default module({ id: 'a', deps: [${deps ? "'@keel/std-temporal'" : ""}], capabilities: [], public: { exports: [] } })\n`;
const files = (type: string, deps: boolean) => [
  { path: "modules/a/module.ts", source: MODULE(deps) },
  { path: "modules/a/d.tsx", source: "export const d = <span foo={1} />\n" },
  {
    path: "modules/a/t.ts",
    source:
      "import { formatLiteral } from '@keel/schema'\nimport { Instant } from '@keel/std-temporal'\n\nexport const t = formatLiteral(Instant, '2026-02-28T00:00:00.000Z')\n",
  },
  { path: "modules/a/a.ts", source: `import { n } from 'foo'\n\nexport const a: ${type} = n\n` },
  { path: "modules/a/b.ts", source: "import { n } from 'foo/sub'\n\nexport const b: number = n\n" },
  { path: "modules/a/c.ts", source: "import { n } from 'bar/x'\n\nexport const c: number = n\n" },
];

/**
 * `check()` from a module instance of its own: no memo, no parsed files, no format registry from this module's calls;
 * the `@keel/std-*` packages `files`' manifests list imported into it first, as `keel check` does (`importDeps`).
 */
async function fresh(root: string, list: readonly { path: string; source: string }[]): Promise<typeof check> {
  vi.resetModules();
  const { importDeps } = await import("@keel/compiler/std/importDeps");
  await importDeps(root, list);
  const m = await import("../src/index.ts");
  return m.check;
}

it(
  "a warm check reports what a cold one does, after every edit of a generated sequence",
  async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(edit, { minLength: 1, maxLength: 3 }), async (edits) => {
        const p = project();
        const folder = join(p.root, "node_modules/.cache/keel");
        let type = "number";
        let deps = true;
        check(files(type, deps), { root: p.root, typeCache: folder });
        for (const e of edits) {
          apply(p, e);
          if (e.k === "a") type = e.type;
          if (e.k === "deps") deps = e.on;
          const warm = check(files(type, deps), { root: p.root, typeCache: folder }).diagnostics;
          const now = files(type, deps);
          const fromDisk = (await fresh(p.root, now))(now, { root: p.root, typeCache: folder }).diagnostics;
          const cold = (await fresh(p.root, now))(now, { root: p.root }).diagnostics;
          expect(warm).toEqual(cold);
          expect(fromDisk).toEqual(cold);
        }
      }),
      { seed: SEED, numRuns: 6 },
    );
  },
  fixedTime(240_000),
);
