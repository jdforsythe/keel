// Spec: k.compiler, clause "That file importing a package `p` whose `index.mjs` line 2 evaluates `os.cpus()`, `process.report.getReport()`, `process.execve('/usr/bin/true')`, `process.openStdin()`, `node:test`'s `run({ files: [] })`, `statSync(<f>).atimeMs`, `process.pid` or `Object.getOwnPropertyDescriptor(globalThis, 'Function').get.call(globalThis)('return 1')` makes `keel check` report one E1050 with no location whose message starts `node:os.cpus`, `process.report`, `process.execve`, `process.openStdin`, `node:test.run`, `node:fs.Stats.atimeMs`, `process.pid` or `Function`, then ` at p/index.mjs:2`, and exit 1."
// Also states, k.compiler Build-time evaluation: "Each view denies by default: one allowlist, `HOST_VIEWS` in `@keel/compiler`, names what is observed or pure of the global object, `process` and each Node built-in."
// Also states, k.compiler Build-time evaluation: "Pure: no host state (`path`, `Buffer`, `crypto` over given bytes, the clock)."
// Also states, k.compiler Build-time evaluation: "The rest is refused with E1050: a member or built-in not listed, one Node adds too (a fact that moves on its own, `os.cpus()`; a stat's `atime`, which a read moves), a function at its call or construction (importing is allowed), any other value at its read; a `.node` addon, at its import; an open for writing; a read by a descriptor it did not open; a code file named at run time; `import.meta.resolve`; `WebAssembly` instantiation with imports."
// Also states, k.compiler Rules: "E1050 a read the build-time evaluation cannot observe (Build-time evaluation), its message starting with what it refused: at the import for an addon; else at the refused call's first project-file frame, or unlocated with `at <package>/<path>:<line>:<col>` next when that frame is a package's, cut from its start to fit."
// Also states, k.check Diagnostics: a message is one line of at most 89 UTF-16 code units (the house rule the E1050 message is cut to).
// Seed 1337 (recorded) for the one property. The household copy of derived-support.ts, built once and cloned per case; the `*.server.ts` file is `modules/setup/gate.guard.ts` (derived-cache-observed-support.ts).
// The package `p` sits under the copy's `node_modules` (derived-cache-loader-support.ts `pkg`), its `index.mjs` line 1 the import the expression needs, line 2 `export default String(<expression>)`.
// "One E1050 with no location" is read as the json record carrying no `path` and no `line`; "then ` at p/index.mjs:2`" as the message holding that text after the refused name (the build follows it with an explanation, clipped to 89). `process.execve` unrefused replaces the `keel check` process (exit 0, no output) and
// `process.openStdin()` holds it open, so each run is bounded by a kill of the child this file spawned. `process.report.writeReport(<path>)` is held to the `process.report` start the clause gives `getReport()`.
// ASSUMED: the "`node:` built-in not on the list" case is `monitorEventLoopDelay()` of `node:perf_hooks` (a host fact that moves on its own); the clause does not name it, and its message is asserted to start `node:perf_hooks.` (the form of `node:child_process.execSync`).
// UNTESTABLE: "a member Node adds is refused until it is listed" (k.compiler Build-time evaluation) needs a Node that adds one.
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { testTime } from "@keel/tooling/test-time";
import fc from "fast-check";
import { afterAll, describe, expect, test } from "vitest";
import { type Raw, e1050Raw, messageOf, pkg } from "./derived-cache-loader-support.ts";
import { guardFile } from "./derived-cache-observed-support.ts";
import {
  BIN,
  type Out,
  type Tree,
  brief,
  childEnv,
  cloneTree,
  dropTree,
  householdTree,
  parseOut,
  put,
  read,
} from "./derived-support.ts";

const SLOW = testTime(600_000);
const BOUND = testTime(240_000);
const TYPES = "declare const x: string;\nexport default x;\n";

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

/** `keel check --format=json` in `dir`, killed when it outlasts the bound (a refusal missing can leave it holding stdin open). */
function checkBounded(dir: string): Out {
  const r = spawnSync(process.execPath, [BIN, "check", "--format=json"], {
    cwd: dir,
    encoding: "utf8",
    env: childEnv({}),
    timeout: BOUND,
    killSignal: "SIGKILL",
  });
  return parseOut(r.status, r.stdout, r.stderr);
}

/** A copy whose guard imports the package `name`, whose `index.mjs` is `line1`, then `export default String(<expr>)` on line 2. */
function withExpression(line1: string, expr: string | ((t: Tree) => string), name = "p", redirect?: string): Tree {
  const t = copy();
  put(t.dir, "f.txt", "1");
  const text = typeof expr === "string" ? expr : expr(t);
  pkg(t, name, "index.mjs", `${line1}\nexport default String(${text});\n`, TYPES);
  guardFile(t, `import p from ${JSON.stringify(name)};\nvoid p;`, redirect);
  return t;
}

/** One E1050, no `path` and no `line`, its message starting `start`, then ` at <name>/index.mjs:2`, within 89 units, exit 1. */
function expectRefusedInPackage(t: Tree, start: string, name = "p"): Raw {
  const out = checkBounded(t.dir);
  const found = e1050Raw(out);
  expect(found, brief(out)).toHaveLength(1);
  const message = messageOf(found[0]);
  expect(message.startsWith(start), message).toBe(true);
  expect(message.indexOf(` at ${name}/index.mjs:2`), message).toBeGreaterThanOrEqual(start.length);
  expect(message.length, message).toBeLessThanOrEqual(89);
  expect(found[0]?.path, brief(out)).toBeUndefined();
  expect(found[0]?.line, brief(out)).toBeUndefined();
  expect(out.status, brief(out)).toBe(1);
  return found[0] ?? {};
}

const PROCESS = "Object.getOwnPropertyDescriptor(globalThis, 'process').get.call(globalThis)";

describe("k.compiler: a member of a host view that is neither observed nor pure is E1050 at the call or access", () => {
  const FILE = (t: Tree): string => JSON.stringify(join(t.dir, "f.txt"));
  const cases: readonly (readonly [string, string, (t: Tree) => string, string])[] = [
    ["`os.cpus()`", "import os from 'node:os';", () => "os.cpus()", "node:os.cpus"],
    ["`process.report.getReport()`", "", () => "process.report.getReport()", "process.report"],
    [
      "`process.report.writeReport(<path>)`",
      "",
      (t) => `process.report.writeReport(${JSON.stringify(join(t.dir, "r.json"))})`,
      "process.report",
    ],
    ["`process.execve('/usr/bin/true')`", "", () => "process.execve('/usr/bin/true')", "process.execve"],
    ["`process.openStdin()`", "", () => "process.openStdin()", "process.openStdin"],
    [
      "`node:test`'s `run({ files: [] })`",
      "import { run } from 'node:test';",
      () => "run({ files: [] })",
      "node:test.run",
    ],
    [
      "`statSync(<f>).atimeMs`",
      "import { statSync } from 'node:fs';",
      (t) => `statSync(${FILE(t)}).atimeMs`,
      "node:fs.Stats.atimeMs",
    ],
    ["`process.pid`", "", () => "process.pid", "process.pid"],
    [
      "`Object.getOwnPropertyDescriptor(globalThis, 'Function').get.call(globalThis)('return 1')`",
      "",
      () => "Object.getOwnPropertyDescriptor(globalThis, 'Function').get.call(globalThis)('return 1')",
      "Function",
    ],
    [
      "the real `process` reached through `Object.getOwnPropertyDescriptor(globalThis, 'process')`: `.pid`",
      "",
      () => `${PROCESS}.pid`,
      "process.pid",
    ],
    [
      "the real `process` reached through `Object.getOwnPropertyDescriptor(globalThis, 'process')`: `.report.getReport()`",
      "",
      () => `${PROCESS}.report.getReport()`,
      "process.report",
    ],
    [
      "`monitorEventLoopDelay()` of `node:perf_hooks`, a built-in not on the list",
      "import { monitorEventLoopDelay } from 'node:perf_hooks';",
      () => "monitorEventLoopDelay()",
      "node:perf_hooks.",
    ],
  ];

  test.each(cases)(
    "package `p` whose `index.mjs` line 2 evaluates %s makes `keel check` report one E1050 with no location whose message starts the refused name, then ` at p/index.mjs:2`, and exit 1",
    (_name, line1, expr, start) => {
      expectRefusedInPackage(withExpression(line1, expr), start);
    },
    SLOW,
  );
});

describe("k.compiler: a member of a host view that is pure still works", () => {
  const pure: readonly (readonly [string, string, string, string])[] = [
    ["`path`", "import path from 'node:path';", "path.join('a', 'b')", "a/b"],
    ["`url`", "", "new URL('file:///x/y').pathname", "/x/y"],
    ["`Buffer`", "", "Buffer.from('abc').toString('hex')", "616263"],
    [
      "`crypto` over given bytes",
      "import { createHash } from 'node:crypto';",
      "createHash('sha256').update('abc').digest('hex')",
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    ],
    ["`util` formatting", "import { format } from 'node:util';", "format('%s-%d', 'a', 2)", "a-2"],
  ];

  test.each(pure)(
    "package `p` evaluating %s is no E1050, and the value reaches `routes.json`",
    (_name, line1, expr, expected) => {
      const t = withExpression(line1, expr, "p", `p === ${JSON.stringify(expected)} ? "members.signin" : "app.start"`);
      const out = checkBounded(t.dir);
      expect(e1050Raw(out), brief(out)).toEqual([]);
      expect(out.status, brief(out)).toBe(0);
      expect(read(t.dir, ".keel/routes.json")).toContain("members.signin");
    },
    SLOW,
  );
});

describe("k.compiler: E1050's position is the project file and line when the call is in a project file", () => {
  test(
    "the guard file reading `process.pid` on line n is one E1050 at `modules/setup/gate.guard.ts` line n, whose message starts `process.pid` and names no package",
    () => {
      // seed 1337
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 5 }), (blank) => {
          const t = copy();
          guardFile(t, `${"\n".repeat(blank)}const pid = process.pid;\nvoid pid;`);
          const out = checkBounded(t.dir);
          const found = e1050Raw(out);
          expect(found, brief(out)).toHaveLength(1);
          expect(found[0]?.path, brief(out)).toBe("modules/setup/gate.guard.ts");
          expect(found[0]?.line, brief(out)).toBe(blank + 1);
          const message = messageOf(found[0]);
          expect(message.startsWith("process.pid"), message).toBe(true);
          expect(message, message).not.toMatch(/ at \S+:\d+$/);
          expect(out.status, brief(out)).toBe(1);
        }),
        { seed: 1337, numRuns: 3 },
      );
    },
    SLOW,
  );

  test(
    "`process.openStdin()` called in the guard file is located at that file and line, and the run ends",
    () => {
      const t = copy();
      guardFile(t, "process.openStdin();");
      const out = checkBounded(t.dir);
      const found = e1050Raw(out);
      expect(found, brief(out)).toHaveLength(1);
      expect(found[0]?.path, brief(out)).toBe("modules/setup/gate.guard.ts");
      expect(found[0]?.line, brief(out)).toBe(1);
      expect(out.status, brief(out)).toBe(1);
    },
    SLOW,
  );
});

describe("k.compiler: in a package, the message holds `at <package>/<path>:<line>:<col>` after the refused name, cut from its start to fit 89 units", () => {
  test(
    "a package of any name length whose `index.mjs` line 2 reads `process.pid` gives one E1050 of at most 89 units that starts `process.pid` and names `index.mjs:2`",
    () => {
      // seed 1337
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 120 }), (n) => {
          const name = `q${"x".repeat(n)}`;
          const t = withExpression("", "process.pid", name);
          const out = checkBounded(t.dir);
          const found = e1050Raw(out);
          expect(found, brief(out)).toHaveLength(1);
          const message = messageOf(found[0]);
          expect(message.startsWith("process.pid"), message).toBe(true);
          expect(message.includes("index.mjs:2"), message).toBe(true);
          expect(message.length, message).toBeLessThanOrEqual(89);
          expect(found[0]?.path, brief(out)).toBeUndefined();
          expect(out.status, brief(out)).toBe(1);
          if (name.length <= 30) expect(message.indexOf(` at ${name}/index.mjs:2`), message).toBe("process.pid".length);
        }),
        { seed: 1337, numRuns: 4 },
      );
    },
    SLOW,
  );
});
