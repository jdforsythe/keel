// k.module the five clauses on E1165, each quoted whole
// Spec: k.module, clause "Module `a` listing `b` in `deps`, with no file of `a` importing from `b`, reports one E1165 at the entry, as it does when only a test file of `a` imports from `b`; its fix removes the entry, and `keel check` then reports neither E1165 nor E1152."
// Spec: k.module, clause "No E1165 for `b` when one non-test file of `a` holds any one of `import { X } from '../b/X.ts'` (`X` public), `import type { X } from '../b/X.ts'`, `export { X } from '../b/X.ts'`, `import('../b/X.ts')`, or an import of `b`'s contract alone."
// Spec: k.module, clause "With `app` (deps `['shop']`) holding a layout `app.frame` and `shop` (deps `[]`) a page bound with `layout: 'app.frame'`, and no import between them, no E1165; with `shop` listing `app` and `app` listing nothing, none either."
// Spec: k.module, clause "Modules `receipts`, `setup` and `shopping`, where `shopping` lists `setup` and `receipts`, `receipts` lists `setup`, with no import behind any of the three, and `setup` lists `shopping` and imports from it: one E1153 and three E1165, one at each of the three entries; after their three fixes, neither code."
// Spec: k.module, clause "A `@keel/std-*` entry the module imports nothing from reports no E1165; an entry `ghost` naming no module of the project reports one."
// Rules: E1165 "a `deps` entry, other than a `@keel/std-*` package, that the module does not use (Checks), a module id the project lacks among them, at the entry, one per entry (fix removes it)."
// Seed 1337
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import {
  SEED,
  type Files,
  codesOf,
  contractFile,
  exportFile,
  has,
  importer,
  lowerId,
  manifestFile,
  pascal,
} from "./module-support.ts";

const distinct = fc.tuple(lowerId, lowerId, pascal).filter(([a, b]) => a !== b);
const distinct3 = fc.tuple(lowerId, lowerId, lowerId).filter(([a, b, c]) => a !== b && b !== c && a !== c);
const NO_TYPES = { types: false } as const;
const lib = (b: string, pub: string): Files => [
  manifestFile({ id: b, exports: [pub] }),
  exportFile(`modules/${b}`, pub),
];

/** Write `files` to a fresh temp dir, `git apply` the fix there, and return the patched files. */
function applyFix(files: Files, fix: string): Files {
  const dir = mkdtempSync(join(tmpdir(), "keel-fix-"));
  try {
    for (const f of files) {
      mkdirSync(dirname(join(dir, f.path)), { recursive: true });
      writeFileSync(join(dir, f.path), f.source);
    }
    writeFileSync(join(dir, "fix.patch"), `${fix}\n`);
    execFileSync("git", ["apply", "--unsafe-paths", "--directory=.", "fix.patch"], { cwd: dir, stdio: "pipe" });
    return files.map((f) => ({ path: f.path, source: readFileSync(join(dir, f.path), "utf8") }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Apply the first E1165 fix and re-check, until none is left; returns the files and the number of fixes applied. */
function fixAll(files: Files): { files: Files; applied: number } {
  let cur = files;
  let applied = 0;
  for (let i = 0; i < 10; i++) {
    const d = codesOf(cur, "E1165").find((x) => x.fix !== undefined);
    if (d?.fix === undefined) break;
    cur = applyFix(cur, d.fix);
    applied++;
  }
  return { files: cur, applied };
}

test("Module a listing b in deps, with no file of a importing from b, reports one E1165 at the entry; its fix removes the entry, and keel check then reports neither E1165 nor E1152", () => {
  fc.assert(
    fc.property(distinct, ([a, b, pub]) => {
      const files = [...lib(b, pub), manifestFile({ id: a, deps: [b] })];
      const d = codesOf(files, "E1165");
      expect(d.length).toBe(1);
      expect(d[0]?.path).toBe(`modules/${a}/module.ts`);
      const fix = d[0]?.fix;
      expect(typeof fix).toBe("string");
      if (fix === undefined) return;
      const patched = applyFix(files, fix);
      const src = patched.find((f) => f.path === `modules/${a}/module.ts`)?.source ?? "";
      expect(src).not.toContain(`'${b}'`);
      expect(has(patched, "E1165")).toBe(false);
      expect(has(patched, "E1152")).toBe(false);
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("E1165: it is reported as well when only a test file of a imports from b", () => {
  fc.assert(
    fc.property(distinct, ([a, b, pub]) => {
      const files = [
        ...lib(b, pub),
        manifestFile({ id: a, deps: [b] }),
        {
          path: `modules/${a}/Order.test.ts`,
          source: `import { ${pub} } from '../${b}/${pub}.ts'\nexport const T = ${pub}\n`,
        },
      ];
      const d = codesOf(files, "E1165");
      expect(d.length).toBe(1);
      expect(d[0]?.path).toBe(`modules/${a}/module.ts`);
    }),
    { seed: SEED, numRuns: 20 },
  );
});

const forms: { name: string; source: (b: string, x: string) => string }[] = [
  { name: "import { X }", source: (b, x) => `import { ${x} } from '../${b}/${x}.ts'\nexport const U = ${x}\n` },
  {
    name: "import type { X }",
    source: (b, x) => `import type { ${x} } from '../${b}/${x}.ts'\nexport type U = typeof ${x}\n`,
  },
  { name: "export { X } from", source: (b, x) => `export { ${x} } from '../${b}/${x}.ts'\n` },
  { name: "import('...')", source: (b, x) => `export const U = () => import('../${b}/${x}.ts')\n` },
];
for (const form of forms) {
  test(`No E1165 for b when one non-test file of a holds ${form.name} from b's public export`, () => {
    fc.assert(
      fc.property(distinct, ([a, b, pub]) => {
        const files = [
          ...lib(b, pub),
          manifestFile({ id: a, deps: [b] }),
          { path: `modules/${a}/Use.ts`, source: form.source(b, pub) },
        ];
        expect(has(files, "E1165")).toBe(false);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });
}

test("No E1165 for b when one non-test file of a imports b's contract alone", () => {
  fc.assert(
    fc.property(distinct, ([a, b]) => {
      const files = [
        manifestFile({ id: b }),
        contractFile(b, [`${b}.show`]),
        manifestFile({ id: a, deps: [b] }),
        {
          path: `modules/${a}/Back.ts`,
          source: `import { ${b} } from '../${b}/${b}.contract.ts'\nexport const Back = ${b}.href('${b}.show')\n`,
        },
      ];
      expect(has(files, "E1165")).toBe(false);
    }),
    { seed: SEED, numRuns: 20 },
  );
});

/** `frame` holds a layout `<frame>.frame`; `page` binds a page with `layout: '<frame>.frame'`; no import between them. */
function layouts(frame: string, page: string, frameDeps: string[], pageDeps: string[]): Files {
  const layoutId = `${frame}.frame`;
  return [
    manifestFile({ id: frame, deps: frameDeps }),
    {
      path: `modules/${frame}/${frame}.contract.ts`,
      source: `import { contract } from '@keel/router/contract'\nexport const ${frame} = contract('${frame}', { '${layoutId}': { layout: true } })\n`,
    },
    {
      path: `modules/${frame}/routes.ts`,
      source: `import { manifest } from '@keel/router'\nimport { ${frame} } from './${frame}.contract.ts'\ndeclare const Page: () => Node\nexport const routes = manifest(${frame}, { '${layoutId}': { component: Page } })\n`,
    },
    manifestFile({ id: page, deps: pageDeps }),
    {
      path: `modules/${page}/${page}.contract.ts`,
      source: `import { contract } from '@keel/router/contract'\nexport const ${page} = contract('${page}', { '${page}.home': { path: '/' } })\n`,
    },
    {
      path: `modules/${page}/routes.ts`,
      source: `import { manifest } from '@keel/router'\nimport { ${page} } from './${page}.contract.ts'\ndeclare const Page: () => Node\nexport const routes = manifest(${page}, { '${page}.home': { component: Page, layout: '${layoutId}' } })\n`,
    },
  ];
}

test("With app (deps ['shop']) holding a layout app.frame and shop (deps []) a page bound with layout: 'app.frame', and no import between them, no E1165", () => {
  fc.assert(
    fc.property(
      fc.tuple(lowerId, lowerId).filter(([x, y]) => x !== y),
      ([app, shop]) => {
        expect(has(layouts(app, shop, [shop], []), "E1165")).toBe(false);
      },
    ),
    { seed: SEED, numRuns: 20 },
  );
});

test("With shop listing app and app listing nothing, no E1165 either", () => {
  fc.assert(
    fc.property(
      fc.tuple(lowerId, lowerId).filter(([x, y]) => x !== y),
      ([app, shop]) => {
        expect(has(layouts(app, shop, [], [app]), "E1165")).toBe(false);
      },
    ),
    { seed: SEED, numRuns: 20 },
  );
});

test("E1165: an entry naming a module whose layout no binding of the listing module names is reported", () => {
  fc.assert(
    fc.property(distinct3, ([app, shop, other]) => {
      const files = [...layouts(app, shop, [shop], []), manifestFile({ id: other, deps: [app] })];
      const d = codesOf(files, "E1165");
      expect(d.length).toBe(1);
      expect(d[0]?.path).toBe(`modules/${other}/module.ts`);
    }),
    { seed: SEED, numRuns: 20 },
  );
});

/** receipts, setup, shopping of the household: shopping lists setup and receipts, receipts lists setup, setup lists shopping and imports from it. */
const household = (): Files => [
  manifestFile({ id: "receipts", deps: ["setup"] }),
  manifestFile({ id: "shopping", deps: ["setup", "receipts"], exports: ["Cart"] }),
  exportFile("modules/shopping", "Cart"),
  manifestFile({ id: "setup", deps: ["shopping"] }),
  importer("setup", "shopping", "Cart", "Wizard"),
];

test("Modules receipts, setup and shopping, with no import behind any of the three edges but setup's: one E1153 and three E1165, one at each of the three entries; after their three fixes, neither code", () => {
  const files = household();
  expect(codesOf(files, "E1153").length).toBe(1);
  const d = codesOf(files, "E1165");
  expect(d.length).toBe(3);
  expect(d.map((x) => x.path).sort()).toEqual([
    "modules/receipts/module.ts",
    "modules/shopping/module.ts",
    "modules/shopping/module.ts",
  ]);
  const fixed = fixAll(files);
  expect(fixed.applied).toBe(3);
  expect(has(fixed.files, "E1165")).toBe(false);
  expect(has(fixed.files, "E1153")).toBe(false);
});

test("A @keel/std-* entry the module imports nothing from reports no E1165", () => {
  fc.assert(
    fc.property(lowerId, (a) => {
      const files = [manifestFile({ id: a, deps: ["@keel/std-brands"] })];
      expect(check(files, NO_TYPES).diagnostics.filter((d) => d.code === "E1165")).toEqual([]);
    }),
    { seed: SEED, numRuns: 10 },
  );
});

test("An entry ghost naming no module of the project reports one E1165, at the entry", () => {
  fc.assert(
    fc.property(
      lowerId.filter((x) => x !== "ghost"),
      (a) => {
        const d = codesOf([manifestFile({ id: a, deps: ["ghost"] })], "E1165");
        expect(d.length).toBe(1);
        expect(d[0]?.path).toBe(`modules/${a}/module.ts`);
      },
    ),
    { seed: SEED, numRuns: 10 },
  );
});

test("E1165 over generated module graphs: every entry flagged is unused, every unused non-std entry is flagged, one per entry", () => {
  // Modules m0..mn in a generated order; an entry i -> j (i < j) is listed or not, and imported or not.
  const graph = fc.uniqueArray(lowerId, { minLength: 2, maxLength: 5 }).chain((ids) =>
    fc
      .array(fc.record({ listed: fc.boolean(), imported: fc.boolean(), inTest: fc.boolean() }), {
        minLength: ids.length * ids.length,
        maxLength: ids.length * ids.length,
      })
      .map((cells) => ({ ids, cells })),
  );
  fc.assert(
    fc.property(graph, ({ ids, cells }) => {
      const files: Files[number][] = [];
      const expected = new Map<string, number>();
      ids.forEach((id, i) => {
        const deps: string[] = [];
        const own: Files[number][] = [];
        ids.forEach((other, j) => {
          const cell = cells[i * ids.length + j];
          if (j <= i || cell === undefined) return;
          if (cell.listed) deps.push(other);
          if (cell.imported) {
            const file = cell.inTest ? `From${other}.test` : `From${other}`;
            own.push({
              path: `modules/${id}/${file}.ts`,
              source: `import { Pub } from '../${other}/Pub.ts'\nexport const ${file.replace(".", "_")} = Pub\n`,
            });
          }
          if (cell.listed && !(cell.imported && !cell.inTest)) expected.set(id, (expected.get(id) ?? 0) + 1);
        });
        files.push(manifestFile({ id, deps, exports: ["Pub"] }), exportFile(`modules/${id}`, "Pub"), ...own);
      });
      const got = new Map<string, number>();
      for (const d of codesOf(files, "E1165")) got.set(d.path, (got.get(d.path) ?? 0) + 1);
      const want = new Map([...expected].map(([id, n]) => [`modules/${id}/module.ts`, n]));
      expect([...got].sort()).toEqual([...want].sort());
    }),
    { seed: SEED, numRuns: 40 },
  );
});
