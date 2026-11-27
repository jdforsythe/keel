// Spec: k.compiler, clause "That file importing a package whose top level calls `require('module')._load('./c.cjs')`, reads `process.mainModule.filename`, or calls `import.meta.resolve('./c.cjs')`, `Function('return 1')` or `process.dlopen({}, 'a.node')` makes `keel check` report one E1050 with no location, its message starting `node:module._load`, `process.mainModule`, `import.meta.resolve`, `Function` or `process.dlopen`, and exit 1."
// Also states, k.compiler Rules: "E1050 a read the build-time evaluation cannot observe (Build-time evaluation), its message starting with what it refused: at the import for an addon; else at the refused call's first project-file frame, or unlocated with `at <package>/<path>:<line>` next when that frame is a package's, cut from its start to fit."
// Also states, k.compiler Build-time evaluation: "The rest is refused with E1050: a member or built-in not listed, one Node adds too (a fact that moves on its own, `os.cpus()`; a stat's `atime`, which a read moves), a function at its call or construction (importing is allowed), any other value at its read; a `.node` addon, at its import; an open for writing; a read by a descriptor it did not open; a code file named at run time; `import.meta.resolve`; `WebAssembly` instantiation with imports."
// Seed 1337 (recorded); no random inputs. The household copy of derived-support.ts, built once and cloned per case; the `*.server.ts` file is `modules/setup/gate.guard.ts` (derived-cache-observed-support.ts).
// One case per refused item. The refusal is at the call, so a refused call is never run: the code of a package case sits in a package under `node_modules` (derived-cache-loader-support.ts), and a `node:` call in the guard file itself.
// "No location" is read as the json record carrying no `path` and no `line`; "its message starting with" as `startsWith` on the message. For a `node:module` member other than `_load`, the message starts `node:module.<member>`,
// the form the clause gives `node:module._load`; for a `node:fs` write, `node:fs.<function>`, the form of `node:child_process.execSync`.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fixedTime } from "@keel/tooling/test-time";
import { afterAll, describe, expect, test } from "vitest";
import { type Raw, e1050Raw, messageOf, pkg, writeAt } from "./derived-cache-loader-support.ts";
import { guardFile } from "./derived-cache-observed-support.ts";
import { type Tree, brief, cloneTree, dropTree, householdTree, keel } from "./derived-support.ts";

const SLOW = fixedTime(600_000);

let house: Tree | undefined;
const made: Tree[] = [];
afterAll(() => {
  for (const t of made) dropTree(t);
});
const copy = (): Tree => {
  house ??= householdTree();
  if (!made.includes(house)) made.push(house);
  const t = cloneTree(house);
  made.push(t);
  return t;
};

/** One E1050, with no location, its message starting `start`, and exit 1. */
function refusedWithoutLocation(t: Tree, start: string): Raw[] {
  const out = keel(t.dir, ["check"]);
  const found = e1050Raw(out);
  expect(found, brief(out)).toHaveLength(1);
  expect(messageOf(found[0]).startsWith(start), messageOf(found[0])).toBe(true);
  expect(found[0]?.path, brief(out)).toBeUndefined();
  expect(found[0]?.line, brief(out)).toBeUndefined();
  expect(out.status, brief(out)).toBe(1);
  return found;
}

/** A copy whose guard imports the package `refuse-like` holding `code` in `file`. */
function withPackage(file: string, code: string): Tree {
  const t = copy();
  writeAt(t.dir, "modules/setup/c.cjs", "module.exports = 1;\n");
  pkg(t, "refuse-like", file, code);
  guardFile(t, 'import "refuse-like";');
  return t;
}

describe("k.compiler: every `node:module` member but `createRequire`, `isBuiltin` and `builtinModules` is refused", () => {
  test.each([
    ["_load", "require('module')._load('./c.cjs');"],
    ["register", "require('module').register('./x.mjs');"],
    ["syncBuiltinESMExports", "require('module').syncBuiltinESMExports();"],
    ["_resolveFilename", "require('module')._resolveFilename('./c.cjs');"],
  ])(
    "a package whose top level calls `require('module').%s` makes `keel check` report one E1050 with no location, its message starting `node:module.%s`, and exit 1",
    (member, call) => {
      refusedWithoutLocation(withPackage("index.cjs", `${call}\n`), `node:module.${member}`);
    },
    SLOW,
  );

  test(
    "`isBuiltin` and `builtinModules` of `node:module` are no E1050",
    () => {
      const t = withPackage(
        "index.cjs",
        "const m = require('module');\nvoid [m.isBuiltin('fs'), m.builtinModules.length];\n",
      );
      const out = keel(t.dir, ["check"]);
      expect(e1050Raw(out), brief(out)).toEqual([]);
      expect(out.status, brief(out)).toBe(0);
    },
    SLOW,
  );
});

describe("k.compiler: the other routes to the host's loader are refused", () => {
  test(
    "a package whose top level reads `process.mainModule.filename` makes `keel check` report one E1050 with no location, its message starting `process.mainModule`, and exit 1",
    () => {
      refusedWithoutLocation(withPackage("index.cjs", "void process.mainModule.filename;\n"), "process.mainModule");
    },
    SLOW,
  );

  test(
    "a package whose top level calls `import.meta.resolve('./c.cjs')` makes `keel check` report one E1050 with no location, its message starting `import.meta.resolve`, and exit 1",
    () => {
      refusedWithoutLocation(withPackage("index.mjs", "void import.meta.resolve('./c.cjs');\n"), "import.meta.resolve");
    },
    SLOW,
  );

  test(
    "a package whose top level calls `Function('return 1')` makes `keel check` report one E1050 with no location, its message starting `Function`, and exit 1",
    () => {
      refusedWithoutLocation(withPackage("index.cjs", "void Function('return 1');\n"), "Function");
    },
    SLOW,
  );

  test(
    "a package whose top level calls `eval('1')` makes `keel check` report one E1050 with no location, its message starting `eval`, and exit 1",
    () => {
      refusedWithoutLocation(withPackage("index.cjs", "void eval('1');\n"), "eval");
    },
    SLOW,
  );

  test(
    "a package whose top level calls `process.dlopen({}, 'a.node')` makes `keel check` report one E1050 with no location, its message starting `process.dlopen`, and exit 1",
    () => {
      refusedWithoutLocation(
        withPackage("index.cjs", "process.dlopen({ exports: {} }, 'a.node');\n"),
        "process.dlopen",
      );
    },
    SLOW,
  );
});

describe("k.compiler: a call into a refused Node module is E1050 at the call (vm, v8, inspector, wasi, sqlite, repl, readline, trace_events)", () => {
  // `call` runs after the import of the module as `cp`; each is refused before it runs.
  test.each([
    ["node:vm", 'cp.runInNewContext("1");', "runInNewContext"],
    ["node:v8", "cp.getHeapStatistics();", "getHeapStatistics"],
    ["node:inspector", "cp.url();", "url"],
    ["node:wasi", 'new cp.WASI({ version: "preview1" });', "WASI"],
    ["node:sqlite", 'new cp.DatabaseSync(":memory:");', "DatabaseSync"],
    ["node:repl", "cp.start();", "start"],
    ["node:readline", "cp.cursorTo(process.stdout, 0);", "cursorTo"],
    ["node:trace_events", 'cp.createTracing({ categories: ["v8"] });', "createTracing"],
  ])(
    "calling or constructing a function of `%s` at the top level is one E1050 whose message starts `%s.<function>`, exit 1",
    (module, call, fn) => {
      const t = copy();
      guardFile(t, `import * as cp from ${JSON.stringify(module)};\n${call}`);
      const out = keel(t.dir, ["check"]);
      const found = e1050Raw(out);
      expect(found, brief(out)).toHaveLength(1);
      expect(messageOf(found[0]).startsWith(`${module}.${fn}`), messageOf(found[0])).toBe(true);
      expect(out.status, brief(out)).toBe(1);
    },
    SLOW,
  );

  test.each([
    "node:vm",
    "node:v8",
    "node:inspector",
    "node:wasi",
    "node:sqlite",
    "node:repl",
    "node:readline",
    "node:trace_events",
  ])(
    "importing `%s` and calling none of its functions is no E1050",
    (module) => {
      const t = copy();
      guardFile(t, `import * as cp from ${JSON.stringify(module)};\nconst kept = typeof cp;\nvoid kept;`);
      const out = keel(t.dir, ["check"]);
      expect(e1050Raw(out), brief(out)).toEqual([]);
      expect(out.status, brief(out)).toBe(0);
    },
    SLOW,
  );
});

describe("k.compiler: a `node:fs` write is E1050 and writes nothing", () => {
  test.each([
    ["writeFileSync", (at: string) => `fs.writeFileSync(${at}, "x");`],
    ["appendFileSync", (at: string) => `fs.appendFileSync(${at}, "x");`],
    ["mkdirSync", (at: string) => `fs.mkdirSync(${at});`],
    ["renameSync", (at: string) => `fs.renameSync(${at}, ${at}.moved);`],
  ])(
    "`fs.%s` at the top level is one E1050 whose message starts `node:fs.%s`, exit 1, and the path is not created",
    (fn, call) => {
      const t = copy();
      const at = join(t.base, "written");
      guardFile(t, `import * as fs from "node:fs";\n${call(JSON.stringify(at))}`);
      const out = keel(t.dir, ["check"]);
      const found = e1050Raw(out);
      expect(found, brief(out)).toHaveLength(1);
      expect(messageOf(found[0]).startsWith(`node:fs.${fn}`), messageOf(found[0])).toBe(true);
      expect(out.status, brief(out)).toBe(1);
      expect(existsSync(at)).toBe(false);
    },
    SLOW,
  );
});
