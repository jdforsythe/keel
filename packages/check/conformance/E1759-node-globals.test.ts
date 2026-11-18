// Spec: k.host, Node globals "A browser file is an app file not named `*.server.*` under `modules/<id>/` of a module a deployable lists, except the `routes.ts` of a module no `client` or `static` deployable lists; with no `topology.ts`, any app file not named `*.server.*`. In a browser file E1759 reports a read of `process`, `Buffer`, `global`, `setImmediate`, `clearImmediate`, `__dirname`, `__filename`, `require`, `import.meta.dirname` or `import.meta.filename`, and a value import, re-export, literal `import()` or `require` of a Node built-in (`node:` or a bare name Node lists as built-in). In any app file, `*.server.*` included, `require`, `__dirname` and `__filename` are E1759: an ES module has none. Fix, outside a browser file: `__dirname` to `import.meta.dirname`, `__filename` to `import.meta.filename`; none otherwise. Not reported: a name the file declares; the operand of `typeof`, and a read under a `typeof x !== 'undefined'` test (`if`, `?:` or `&&`); members of `globalThis`; `import type`; tests, `*.config.*`, `unsafe/`, `.keel/` and `node_modules/`."
// Spec: k.host, Rules "E1759 a Node-only global or built-in import in a browser file, or `require`, `__dirname` or `__filename` in an ES module (fix: `import.meta.dirname` or `import.meta.filename` outside a browser file)."
// Spec: k.host, Conformance "In `modules/shop/Badge.tsx` of a `node` deployable, each one E1759: `process.env.X`, `Buffer.from(s)`, `global.x`, `setImmediate(f)`, `import.meta.dirname`, `import fs from 'node:fs'`, `import { join } from 'path'`, `export { readFile } from 'fs'`, `import('node:os')`, `require('x')`, `__dirname`; and with a `client` deployable listing `shop`, in `modules/shop/stock.ts`."
// Spec: k.host, Conformance "None: the reads but `require`, `__dirname` and `__filename` in `modules/shop/stock.server.ts` and in `routes.ts` of a module only `node` deployables list; all of them in `Badge.test.tsx` and `vite.config.ts`; `typeof process`, `typeof process !== 'undefined' && process.env.X`, `globalThis.process`, `import type { Buffer } from 'node:buffer'`, `const process = { env: {} }; process.env`, and `import x from 'pathe'`."
// Spec: k.host, Conformance "`__dirname` in `modules/shop/paths.server.ts` is one E1759 whose fix writes `import.meta.dirname` and re-checks clean; in `Badge.tsx` it carries no fix."
// Seed 1337 (the properties below). Each fixture is a project tree with a `topology.ts` unless the test says otherwise;
// the type pass is off (the rule reads syntax and the topology).
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import {
  type Adapter,
  applyFix,
  asSource,
  bare,
  e1759,
  file,
  realApp,
  shop,
  shopBoth,
  topology,
} from "./E1759-support.ts";
import { SEED } from "./support.ts";

const BADGE = "modules/shop/Badge.tsx";
const STOCK = "modules/shop/stock.ts";
const SERVER = "modules/shop/stock.server.ts";
const ROUTES = "modules/shop/routes.ts";

/** Reads of a Node-only global in a browser file. */
const GLOBAL_READS = [
  "process.env.X",
  "Buffer.from(s)",
  "global.x",
  "setImmediate(f)",
  "clearImmediate(h)",
  "import.meta.dirname",
  "import.meta.filename",
];
/** Names an ES module has none of, anywhere in app code. */
const ES_ONLY = ["require('x')", "__dirname", "__filename"];
/** Statements importing or re-exporting a Node built-in. */
const BUILTIN_STMTS = [
  "import fs from 'node:fs'",
  "import { join } from 'path'",
  "export { readFile } from 'fs'",
  "export const v = import('node:os')",
];
const REPORTING = [...GLOBAL_READS, ...ES_ONLY, ...BUILTIN_STMTS];

const count = (files: Parameters<typeof e1759>[0]) => e1759(files).length;
const inFile = (adapter: Adapter, path: string, stmt: string) => count(shop(adapter, [file(path, asSource(stmt))]));

describe("k.host Node globals: in `modules/shop/Badge.tsx` of a `node` deployable each is one E1759", () => {
  for (const stmt of GLOBAL_READS) {
    test(`\`${stmt}\` is one E1759`, () => {
      const d = e1759(shop("node", [file(BADGE, asSource(stmt))]));
      expect(d.length).toBe(1);
      expect(d[0]?.path).toBe(BADGE);
    });
  }

  test("`import fs from 'node:fs'` is one E1759", () => {
    expect(inFile("node", BADGE, "import fs from 'node:fs'\nexport const v = fs")).toBe(1);
  });

  test("`import { join } from 'path'` is one E1759", () => {
    expect(inFile("node", BADGE, "import { join } from 'path'\nexport const v = join")).toBe(1);
  });

  test("`export { readFile } from 'fs'` is one E1759", () => {
    expect(inFile("node", BADGE, "export { readFile } from 'fs'")).toBe(1);
  });

  test("`import('node:os')` is one E1759", () => {
    expect(inFile("node", BADGE, "import('node:os')")).toBe(1);
  });

  test("`require('x')` is one E1759", () => {
    expect(inFile("node", BADGE, "require('x')")).toBe(1);
  });

  test("`__dirname` is one E1759", () => {
    expect(inFile("node", BADGE, "__dirname")).toBe(1);
  });

  test("`__filename` is one E1759", () => {
    expect(inFile("node", BADGE, "__filename")).toBe(1);
  });

  test("a diagnostic is at the read: its `line` is the line of the name", () => {
    const src = "export const a = 1\nexport const b = 2\nexport const v = process.env.X\n";
    const d = e1759(shop("node", [file(BADGE, src)]));
    expect(d.length).toBe(1);
    expect(d[0]?.line).toBe(3);
  });

  test("each read of a Node-only global is one E1759: two reads are two", () => {
    const src = "export const a = process.env.A\nexport const b = Buffer.from('x')\n";
    expect(count(shop("node", [file(BADGE, src)]))).toBe(2);
  });
});

describe("k.host Node globals: a browser file is any app file not named `*.server.*` of a listed module", () => {
  test("with a `client` deployable listing `shop`, every report of Badge.tsx is one E1759 in `modules/shop/stock.ts`", () => {
    for (const stmt of REPORTING) expect(inFile("client", STOCK, stmt)).toBe(1);
  });

  test("with a `static` deployable listing `shop`, every report is one E1759 in `modules/shop/stock.ts`", () => {
    for (const stmt of REPORTING) expect(inFile("static", STOCK, stmt)).toBe(1);
  });

  test("with no `topology.ts`, every report is one E1759 in `src/Badge.tsx`", () => {
    for (const stmt of REPORTING) expect(count(bare([file("src/Badge.tsx", asSource(stmt))]))).toBe(1);
  });

  test("with no `topology.ts`, a `.server.` file reports only `require`, `__dirname` and `__filename`", () => {
    for (const stmt of GLOBAL_READS) expect(count(bare([file("src/stock.server.ts", asSource(stmt))]))).toBe(0);
    for (const stmt of ES_ONLY) expect(count(bare([file("src/stock.server.ts", asSource(stmt))]))).toBe(1);
  });

  test("a file in a subfolder of the module is a browser file", () => {
    for (const stmt of REPORTING) expect(inFile("node", "modules/shop/ui/deep/Cell.tsx", stmt)).toBe(1);
  });

  test("the `routes.ts` of a module a `client` or `static` deployable lists is a browser file", () => {
    for (const stmt of GLOBAL_READS) expect(count(shopBoth([file(ROUTES, asSource(stmt))]))).toBe(1);
    for (const stmt of GLOBAL_READS) expect(inFile("static", ROUTES, stmt)).toBe(1);
    for (const stmt of GLOBAL_READS) expect(inFile("client", ROUTES, stmt)).toBe(1);
  });

  test("a module no deployable lists has no browser file", () => {
    const files = [
      topology({ web: { modules: ["shop"], adapter: "client" } }),
      file("modules/orphan/x.ts", "export const v = process.env.X\n"),
    ];
    expect(count(files)).toBe(0);
  });

  test("a file outside `modules/<id>/` is no browser file when a `topology.ts` exists", () => {
    for (const stmt of GLOBAL_READS) expect(count(shop("client", [file("server.ts", asSource(stmt))]))).toBe(0);
    for (const stmt of GLOBAL_READS) expect(count(shop("client", [file("scripts/seed.ts", asSource(stmt))]))).toBe(0);
  });
});

describe("k.host Node globals: `require`, `__dirname` and `__filename` are E1759 in every app file, `*.server.*` included", () => {
  for (const stmt of ES_ONLY) {
    test(`\`${stmt}\` in \`modules/shop/stock.server.ts\` is one E1759`, () => {
      expect(inFile("node", SERVER, stmt)).toBe(1);
    });
  }

  test("each of the three is one E1759 in a `*.server.tsx` and a `load.server.ts` of a `client` module", () => {
    for (const path of ["modules/shop/Stock.server.tsx", "modules/shop/load.server.ts"]) {
      for (const stmt of ES_ONLY) expect(inFile("client", path, stmt)).toBe(1);
    }
  });
});

describe("k.host Node globals: none, the reads but `require`, `__dirname` and `__filename`", () => {
  test("every read of a Node global and every Node built-in import in `modules/shop/stock.server.ts` is none", () => {
    for (const stmt of [...GLOBAL_READS, ...BUILTIN_STMTS]) expect(inFile("node", SERVER, stmt)).toBe(0);
    for (const stmt of [...GLOBAL_READS, ...BUILTIN_STMTS]) expect(inFile("client", SERVER, stmt)).toBe(0);
  });

  test("every read of a Node global and every Node built-in import in `routes.ts` of a module only `node` deployables list is none", () => {
    for (const stmt of [...GLOBAL_READS, ...BUILTIN_STMTS]) expect(inFile("node", ROUTES, stmt)).toBe(0);
    const two = [
      topology({ a: { modules: ["shop"], adapter: "node" }, b: { modules: ["other"], adapter: "node" } }),
      file(ROUTES, "export const v = process.env.X\n"),
    ];
    expect(count(two)).toBe(0);
  });

  test("`require`, `__dirname` and `__filename` in that `routes.ts` are still E1759: an ES module has none", () => {
    for (const stmt of ES_ONLY) expect(inFile("node", ROUTES, stmt)).toBe(1);
  });

  test("`process.env.X`, `Buffer.from(s)` and `import fs from 'node:fs'` in `server.ts` at the app root with a topology are none", () => {
    for (const stmt of ["process.env.X", "Buffer.from(s)", "import fs from 'node:fs'\nexport const v = fs"]) {
      expect(count(shop("node", [file("server.ts", asSource(stmt))]))).toBe(0);
    }
  });

  test("everything in `modules/shop/Badge.test.tsx` is none", () => {
    for (const stmt of REPORTING) expect(inFile("client", "modules/shop/Badge.test.tsx", stmt)).toBe(0);
  });

  test("everything in `modules/shop/stock.test.ts` is none", () => {
    for (const stmt of REPORTING) expect(inFile("client", "modules/shop/stock.test.ts", stmt)).toBe(0);
  });

  test("everything in `vite.config.ts` at the root and `*.config.*` in a module is none", () => {
    for (const path of ["vite.config.ts", "vitest.config.ts", "modules/shop/tailwind.config.ts"]) {
      for (const stmt of REPORTING) expect(count(shop("client", [file(path, asSource(stmt))]))).toBe(0);
    }
  });

  test("everything in `unsafe/`, `.keel/` and `node_modules/` is none", () => {
    for (const path of [
      "modules/shop/unsafe/x.ts",
      "unsafe/x.ts",
      "modules/shop/.keel/x.ts",
      ".keel/x.ts",
      "modules/shop/node_modules/pkg/x.ts",
      "node_modules/pkg/x.ts",
    ]) {
      for (const stmt of REPORTING) expect(count(shop("client", [file(path, asSource(stmt))]))).toBe(0);
    }
  });
});

describe("k.host Node globals: guards, host probes and declared names are none", () => {
  const none = (name: string, src: string) =>
    test(`${name} is none in Badge.tsx`, () => {
      expect(count(shop("client", [file(BADGE, src)]))).toBe(0);
    });

  none("`typeof process`", "export const v = typeof process\n");
  none(
    "`typeof process !== 'undefined' && process.env.X`",
    "export const v = typeof process !== 'undefined' && process.env.X\n",
  );
  none(
    "`if (typeof Buffer !== 'undefined') Buffer.from(s)`",
    "export function f(s: string) {\n  if (typeof Buffer !== 'undefined') return Buffer.from(s)\n  return s\n}\n",
  );
  none(
    "`typeof process !== 'undefined' ? process.env.X : undefined`",
    "export const v = typeof process !== 'undefined' ? process.env.X : undefined\n",
  );
  none("`typeof global !== 'undefined' && global.x`", "export const v = typeof global !== 'undefined' && global.x\n");
  none("`globalThis.process`", "export const v = globalThis.process\n");
  none("`globalThis.process?.env.X`", "export const v = globalThis.process?.env.X\n");
  none("`globalThis.Buffer`", "export const v = globalThis.Buffer\n");
  none(
    "`import type { Buffer } from 'node:buffer'`",
    "import type { Buffer } from 'node:buffer'\nexport type B = Buffer\n",
  );
  none("`import type fs from 'node:fs'`", "import type fs from 'node:fs'\nexport type F = typeof fs\n");
  none("`const process = { env: {} }; process.env`", "const process = { env: {} }\nexport const v = process.env\n");
  none(
    "a parameter named `require`",
    "export function f(require: (x: string) => number) {\n  return require('x')\n}\n",
  );
  none("a parameter named `process`", "export function f(process: { env: object }) {\n  return process.env\n}\n");
  none("a function named `Buffer`", "function Buffer() { return 1 }\nexport const v = Buffer()\n");
  none("a class named `Buffer`", "class Buffer {}\nexport const v = new Buffer()\n");
  none(
    "a name imported from a project file: `import { Buffer } from './mine.ts'`",
    "import { Buffer } from './mine.ts'\nexport const v = Buffer.from('x')\n",
  );
  none("`const __dirname = '/app'`", "const __dirname = '/app'\nexport const v = __dirname\n");
  none("`import x from 'pathe'`", "import x from 'pathe'\nexport const v = x\n");
  none("`import x from 'fs-extra'`", "import x from 'fs-extra'\nexport const v = x\n");
  none("`import x from 'node-fetch'`", "import x from 'node-fetch'\nexport const v = x\n");
  none("`import x from 'processing'`", "import x from 'processing'\nexport const v = x\n");
  none("`import x from './path.ts'`", "import x from './path.ts'\nexport const v = x\n");
  none("`import x from '@keel/ui'`", "import x from '@keel/ui'\nexport const v = x\n");
  none(
    "a member named `process`: `ctx.process.env`",
    "export const v = (ctx: { process: { env: object } }) => ctx.process.env\n",
  );
  none(
    "a member named `Buffer` and `global`",
    "export const v = (o: { Buffer: number; global: number }) => o.Buffer + o.global\n",
  );
  none("an object key named `process`", "export const v = { process: 1, Buffer: 2, global: 3 }\n");
  none(
    "`import.meta.env`, `import.meta.url` and `import.meta.glob`",
    "export const a = import.meta.env\nexport const b = import.meta.url\nexport const c = import.meta.glob('./x/*.ts')\n",
  );
  none(
    "a string, a template text and a comment naming `process.env`",
    "// process.env.X, require('x'), __dirname\nexport const v = ['process.env.X', `Buffer.from(s) __dirname`]\n",
  );
  none("`Date.now` and `setTimeout` (other rules')", "export const v = [Date.now, setTimeout]\n");
  none(
    "a JSX text child that spells `process`",
    "export default function Badge() { return <span>process Buffer require</span> }\n",
  );

  test("a `.server.` file may declare `require` through `createRequire`", () => {
    const src =
      "import { createRequire } from 'node:module'\nconst require = createRequire(import.meta.url)\nexport const v = require('x')\n";
    expect(count(shop("node", [file(SERVER, src)]))).toBe(0);
  });

  test("every Node global name is one E1759 bare, none under a `typeof` guard, a shadowing declaration or `globalThis`", () => {
    const names = [
      "process",
      "Buffer",
      "global",
      "setImmediate",
      "clearImmediate",
      "__dirname",
      "__filename",
      "require",
    ];
    fc.assert(
      fc.property(fc.constantFrom(...names), (n) => {
        const run = (src: string) => count(shop("client", [file(BADGE, src)]));
        expect(run(`export const v = ${n}\n`)).toBe(1);
        expect(run(`export const v = typeof ${n}\n`)).toBe(0);
        expect(run(`export const v = typeof ${n} !== 'undefined' && ${n}\n`)).toBe(0);
        expect(run(`export const v = typeof ${n} !== 'undefined' ? ${n} : 0\n`)).toBe(0);
        expect(run(`const ${n} = 1\nexport const v = ${n}\n`)).toBe(0);
        expect(run(`export function f(${n}: number) {\n  return ${n}\n}\n`)).toBe(0);
        expect(run(`export const v = globalThis.${n}\n`)).toBe(0);
      }),
      { seed: SEED, numRuns: 40 },
    );
  });
});

describe("k.host Node globals: a Node built-in is found by `node:` or by its bare name", () => {
  const BUILTINS = [
    "fs",
    "path",
    "os",
    "crypto",
    "child_process",
    "fs/promises",
    "url",
    "stream",
    "zlib",
    "http",
    "worker_threads",
    "events",
    "util",
  ];
  test("a value import, re-export and literal `import()` of any built-in is one E1759 in a browser file, with or without `node:`", () => {
    fc.assert(
      fc.property(fc.constantFrom(...BUILTINS), fc.constantFrom("", "node:"), (b, prefix) => {
        const spec = `${prefix}${b}`;
        const run = (src: string, path = BADGE) => count(shop("client", [file(path, src)]));
        expect(run(`import x from '${spec}'\nexport const v = x\n`)).toBe(1);
        expect(run(`import * as x from '${spec}'\nexport const v = x\n`)).toBe(1);
        expect(run(`import { y } from '${spec}'\nexport const v = y\n`)).toBe(1);
        expect(run(`export { y } from '${spec}'\n`)).toBe(1);
        expect(run(`export const v = import('${spec}')\n`)).toBe(1);
        expect(run(`import type { y } from '${spec}'\nexport type T = y\n`)).toBe(0);
        expect(run(`import x from '${spec}'\nexport const v = x\n`, SERVER)).toBe(0);
      }),
      { seed: SEED, numRuns: 60 },
    );
  });
});

describe("k.host Node globals: the fix", () => {
  const dirnameCase = shop("node", [file("modules/shop/paths.server.ts", "export const paths = __dirname\n")]);
  const filenameCase = shop("node", [file("modules/shop/paths.server.ts", "export const paths = __filename\n")]);

  test("`__dirname` in `modules/shop/paths.server.ts` is one E1759 whose fix writes `import.meta.dirname` and re-checks clean", () => {
    const d = e1759(dirnameCase);
    expect(d.length).toBe(1);
    const fix = d[0]?.fix;
    expect(typeof fix).toBe("string");
    if (fix === undefined) return;
    const patched = applyFix(dirnameCase, fix);
    const src = patched.find((x) => x.path === "modules/shop/paths.server.ts")?.source ?? "";
    expect(src).toContain("import.meta.dirname");
    expect(src).not.toContain("__dirname");
    expect(count(patched)).toBe(0);
  });

  test("`__filename` in `modules/shop/paths.server.ts` is one E1759 whose fix writes `import.meta.filename` and re-checks clean", () => {
    const d = e1759(filenameCase);
    expect(d.length).toBe(1);
    const fix = d[0]?.fix;
    expect(typeof fix).toBe("string");
    if (fix === undefined) return;
    const patched = applyFix(filenameCase, fix);
    const src = patched.find((x) => x.path === "modules/shop/paths.server.ts")?.source ?? "";
    expect(src).toContain("import.meta.filename");
    expect(src).not.toContain("__filename");
    expect(count(patched)).toBe(0);
  });

  test("`__dirname` and `__filename` in `Badge.tsx` carry no fix", () => {
    for (const stmt of ["__dirname", "__filename"]) {
      const d = e1759(shop("node", [file(BADGE, asSource(stmt))]));
      expect(d.length).toBe(1);
      expect(d[0]?.fix).toBeUndefined();
    }
  });

  test("a read of `process`, `Buffer`, `global`, a built-in import and `require` carry no fix, in a browser file and outside it", () => {
    for (const stmt of [...GLOBAL_READS, ...BUILTIN_STMTS, "require('x')"]) {
      for (const d of e1759(shop("client", [file(STOCK, asSource(stmt))]))) expect(d.fix).toBeUndefined();
    }
    for (const d of e1759(shop("node", [file(SERVER, asSource("require('x')"))]))) expect(d.fix).toBeUndefined();
  });

  test("a fix never names `node_modules/`", () => {
    const d = e1759(dirnameCase);
    for (const x of d) {
      for (const line of (x.fix ?? "").split("\n")) {
        if (line.startsWith("--- a/") || line.startsWith("+++ b/")) expect(line).not.toContain("node_modules/");
      }
    }
  });
});

describe("k.host Node globals: real apps", () => {
  for (const app of ["apps/golden-1", "apps/golden-2", "apps/inspector"]) {
    test(`${app}, files and topology as they are, reports no E1759`, () => {
      const files = realApp(app);
      expect(files.some((x) => x.path === "topology.ts")).toBe(true);
      expect(e1759(files)).toEqual([]);
    });
  }

  test("a real app's browser module reads no Node global: adding one to a real component file is one E1759", () => {
    const files = realApp("apps/golden-2");
    const target = files.find((x) => x.path.startsWith("modules/recipes/") && x.path.endsWith(".tsx"));
    expect(target).toBeDefined();
    if (target === undefined) return;
    const changed = files.map((x) =>
      x.path === target.path ? { ...x, source: `${x.source}\nexport const probe = process.env.X\n` } : x,
    );
    expect(e1759(changed).map((d) => d.path)).toEqual([target.path]);
  });
});
