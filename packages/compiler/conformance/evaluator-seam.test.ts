// Spec: k.evaluator, clause "`evaluate`, called in a process whose `globalThis.document` is an object, with an entry holding `export const d = typeof document`, resolves to `{ d: 'undefined' }`."
// Spec: k.evaluator, clause "After `evaluate` of an entry holding `globalThis.keelMark = 1; Math.keelMark = 1; process.env.KEEL_MARK = '1'; export const n = 1`, the caller's `globalThis.keelMark`, `Math.keelMark` and `process.env.KEEL_MARK` are undefined, and a second `evaluate` of an entry holding `export const m = String(Math.keelMark)` resolves to `{ m: 'undefined' }`."
// Spec: k.evaluator, clause "`evaluate`, called with `KEEL_PROBE=1` in the caller's environment, with an entry holding `export const k = Object.keys(process.env)`, resolves to a `k` holding none of `KEEL_PROBE`, `PATH` and `HOME`; with an entry holding `export const z = Buffer.allocUnsafe(64).every((b) => b === 0)`, to `{ z: true }`."
// Spec: k.evaluator, clause "`evaluate` of an entry whose top level calls `process.getBuiltinModule('node:fs').readFileSync('/etc/hosts')`, `process.getBuiltinModule('node:fs').writeFileSync(<a path in the test's folder>, 'x')`, `process.getBuiltinModule('node:child_process').spawnSync(process.execPath, ['-v'])`, `new Function('return 1')` or `(() => 1).constructor('return 1')` resolves to a failure whose code is E1050, and the write leaves no file at its path."
// Spec: k.evaluator, clause "`evaluate` of an entry holding `setInterval(() => {}, 10); export const n = 1` resolves to `{ n: 1 }`, and the child has exited."
// Spec: k.evaluator, clause "`evaluate` of an entry whose top level is `await new Promise(() => {})` resolves within 5 s to a failure whose code is E1048 and whose message ends `a top-level await never settles`."
// Spec: k.evaluator, clause "`evaluate` given `deadlineMs: 200` and an entry whose top level is `for (;;) {}`, or `setInterval(() => {}, 10); await new Promise(() => {})`, resolves within 5 s to a failure whose code is E1048 and whose message ends `in 200 ms`, and the child has exited."
// Spec: k.evaluator, clause "`evaluate` of an entry whose top level calls `process.exit(3)` resolves to a failure whose code is E1049 and whose message ends `the evaluator ended with exit 3`; one calling `process.abort()`, to one ending `with signal SIGABRT`."
// Also states, k.evaluator Below the views: "Node and V8 refuse these in an evaluator whatever code asks and however it came by a name: reading a file outside the entry's folder; writing, renaming or removing one; starting a process or a worker; loading an addon or WASI; opening the inspector; making code from a string (`eval`, `new Function`, a function's `constructor`). Each is E1050 when it ends a file's evaluation."
// Also states, k.evaluator Start: "It starts Node on `entry`, a file in a folder holding nothing else, with `--permission`, `--allow-fs-read` naming that folder alone, `--disallow-code-generation-from-strings` and `--zero-fill-buffers`, in a new empty working folder, with an environment built from nothing: `TZ`, `LANG` and each `LC_*` name of the command's, and no other value of it."
// Also states, k.evaluator: "nothing the command's process holds (a dev server's globals, an earlier evaluation's write to `Math`) reaches it, and nothing it does reaches the command's process but its result."
// Also states, k.evaluator Rules: "E1048 a build-time evaluation that gave no result, message `<file> did not finish evaluating: a top-level await never settles` or `<file> did not finish evaluating in <n> ms`, `<n>` the deadline; fix: none · E1049 (k.compiler) from an evaluator that ended early, message `<file>: the evaluator ended with exit <code>` or `with signal <name>`."
// Seed 1337 (recorded) for the properties. The entry is an `.mjs` file in a folder the test makes (realpath of a `mkdtemp` under the OS temp folder); `evaluate` is called directly, so the realm is Node's own (the banner prepares it for a bundle, not `evaluate`).
// ASSUMED: `evaluate` resolves to the entry's exports (the object) on success and to an object holding string `code` and `message` on failure (k.evaluator Start: "to the entry's exports as JSON or to one failure (a code and a message)").
// "The child has exited" is as the rules-host clause asserts it: `evaluate` resolves only after the child's `exit` event, so the resolved value and the call's return are what the cases assert.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evaluate } from "@keel/compiler";
import { testTime } from "@keel/tooling/test-time";
import fc from "fast-check";
import { afterAll, describe, expect, test } from "vitest";

const BOUND = testTime(30_000);
const FIVE = testTime(5_000);
const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

/** A new folder (real path) the test owns. */
function scratch(): string {
  const d = realpathSync(mkdtempSync(join(tmpdir(), "keel-evaluator-")));
  made.push(d);
  return d;
}

/** Writes `source` as the entry of a folder holding nothing else and returns its path. */
function entryOf(source: string): string {
  const dir = join(scratch(), "entry");
  mkdirSync(dir);
  const file = join(dir, "entry.mjs");
  writeFileSync(file, source);
  return file;
}

type Failure = { code: string; message: string };

/** The failure a result is, `undefined` when it is the entry's exports. */
function failureOf(r: unknown): Failure | undefined {
  if (typeof r !== "object" || r === null) return undefined;
  const code: unknown = Reflect.get(r, "code");
  const message: unknown = Reflect.get(r, "message");
  return typeof code === "string" && /^E\d{4}$/.test(code) && typeof message === "string"
    ? { code, message }
    : undefined;
}

const run = (source: string, deadlineMs?: number): Promise<unknown> =>
  evaluate(
    deadlineMs === undefined
      ? { kind: "data", entry: entryOf(source) }
      : { kind: "data", entry: entryOf(source), deadlineMs },
  );

describe("k.evaluator: `evaluate` keeps the caller's process out of the evaluation", () => {
  test(
    "`evaluate`, called in a process whose `globalThis.document` is an object, with an entry holding `export const d = typeof document`, resolves to `{ d: 'undefined' }`",
    async () => {
      Reflect.set(globalThis, "document", {});
      try {
        expect(await run("export const d = typeof document")).toEqual({ d: "undefined" });
      } finally {
        Reflect.deleteProperty(globalThis, "document");
      }
    },
    BOUND,
  );

  test(
    "after `evaluate` of an entry holding `globalThis.keelMark = 1; Math.keelMark = 1; process.env.KEEL_MARK = '1'; export const n = 1`, the caller's `globalThis.keelMark`, `Math.keelMark` and `process.env.KEEL_MARK` are undefined, and a second `evaluate` of an entry holding `export const m = String(Math.keelMark)` resolves to `{ m: 'undefined' }`",
    async () => {
      const first = await run(
        "globalThis.keelMark = 1; Math.keelMark = 1; process.env.KEEL_MARK = '1'; export const n = 1",
      );
      expect(first).toEqual({ n: 1 });
      expect(Reflect.get(globalThis, "keelMark")).toBeUndefined();
      expect(Reflect.get(Math, "keelMark")).toBeUndefined();
      expect(process.env.KEEL_MARK).toBeUndefined();
      expect(await run("export const m = String(Math.keelMark)")).toEqual({ m: "undefined" });
    },
    BOUND,
  );

  test(
    "a dependency that sets `globalThis` members or `process.title` is not visible in the caller's process afterwards (nothing it does reaches the command's process but its result)",
    async () => {
      const title = process.title;
      const out = await run("globalThis.keelHost = 1; process.title = 'keel-evaluator-mark'; export const n = 1");
      expect(out).toEqual({ n: 1 });
      expect(Reflect.get(globalThis, "keelHost")).toBeUndefined();
      expect(process.title).toBe(title);
    },
    BOUND,
  );
});

describe("k.evaluator: the evaluator's environment is built from nothing", () => {
  test(
    "`evaluate`, called with `KEEL_PROBE=1` in the caller's environment, with an entry holding `export const k = Object.keys(process.env)`, resolves to a `k` holding none of `KEEL_PROBE`, `PATH` and `HOME`",
    async () => {
      process.env.KEEL_PROBE = "1";
      try {
        const out = await run("export const k = Object.keys(process.env)");
        expect(failureOf(out)).toBeUndefined();
        const k: unknown = typeof out === "object" && out !== null ? Reflect.get(out, "k") : undefined;
        expect(Array.isArray(k)).toBe(true);
        for (const name of ["KEEL_PROBE", "PATH", "HOME"]) expect(k).not.toContain(name);
      } finally {
        Reflect.deleteProperty(process.env, "KEEL_PROBE");
      }
    },
    BOUND,
  );

  test(
    "with an entry holding `export const z = Buffer.allocUnsafe(64).every((b) => b === 0)`, `evaluate` resolves to `{ z: true }`",
    async () => {
      expect(await run("export const z = Buffer.allocUnsafe(64).every((b) => b === 0)")).toEqual({ z: true });
    },
    BOUND,
  );

  test(
    "an environment name of the caller that is not `TZ`, `LANG` or `LC_*` is absent from the evaluator's environment, whatever its name and value; `LANG` and each `LC_*` name of the caller's is present",
    async () => {
      const name = fc
        .array(fc.constantFrom(..."ABCDEFGHJKLMNPQRSTUVWXYZ0123456789_"), { minLength: 3, maxLength: 8 })
        .map((a) => `KEEL_X_${a.join("")}`);
      await fc.assert(
        fc.asyncProperty(name, fc.string({ minLength: 1, maxLength: 8 }), async (n, v) => {
          // seed 1337
          process.env[n] = v;
          process.env.LANG = "C";
          process.env.LC_TIME = "C";
          try {
            const out = await run("export const k = Object.keys(process.env)");
            const k: unknown = typeof out === "object" && out !== null ? Reflect.get(out, "k") : undefined;
            expect(k).not.toContain(n);
            expect(k).toContain("LANG");
            expect(k).toContain("LC_TIME");
          } finally {
            Reflect.deleteProperty(process.env, n);
          }
        }),
        { seed: 1337, numRuns: 4 },
      );
    },
    BOUND,
  );
});

describe("k.evaluator: Node and V8 refuse these whatever code asks", () => {
  const folder = (): string => scratch();
  const cases: readonly (readonly [string, (target: string) => string])[] = [
    [
      "`process.getBuiltinModule('node:fs').readFileSync('/etc/hosts')`",
      () => "process.getBuiltinModule('node:fs').readFileSync('/etc/hosts')",
    ],
    [
      "`process.getBuiltinModule('node:fs').writeFileSync(<a path in the test's folder>, 'x')`",
      (target) => `process.getBuiltinModule('node:fs').writeFileSync(${JSON.stringify(target)}, 'x')`,
    ],
    [
      "`process.getBuiltinModule('node:child_process').spawnSync(process.execPath, ['-v'])`",
      () => "process.getBuiltinModule('node:child_process').spawnSync(process.execPath, ['-v'])",
    ],
    ["`new Function('return 1')`", () => "new Function('return 1')"],
    ["`(() => 1).constructor('return 1')`", () => "(() => 1).constructor('return 1')"],
  ];
  test.each(cases)(
    "`evaluate` of an entry whose top level calls %s resolves to a failure whose code is E1050, and the write leaves no file at its path",
    async (_name, call) => {
      const target = join(folder(), "written.txt");
      const out = await run(`${call(target)};\nexport const n = 1;`);
      expect(failureOf(out)?.code, JSON.stringify(out)).toBe("E1050");
      expect(existsSync(target)).toBe(false);
    },
    BOUND,
  );

  // Below the views: reads outside the entry's folder, writes, renames, removals, a process, a worker, an addon, the inspector, WASI: each refused whatever the call, by the runtime (no view is involved in an entry `evaluate` runs directly).
  test(
    "a read, listing or stat of a file outside the entry's folder, a rename, a removal, a worker, an addon, the inspector and WASI are each a failure whose code is E1050, and the files keep their bytes",
    async () => {
      const other = scratch();
      const a = join(other, "a.txt");
      const b = join(other, "b.txt");
      writeFileSync(a, "keep");
      const fs = "process.getBuiltinModule('node:fs')";
      const calls: readonly string[] = [
        `${fs}.readFileSync(${JSON.stringify(a)})`,
        `${fs}.readdirSync(${JSON.stringify(other)})`,
        `${fs}.statSync(${JSON.stringify(a)})`,
        `${fs}.openSync(${JSON.stringify(a)}, 'r')`,
        `${fs}.renameSync(${JSON.stringify(a)}, ${JSON.stringify(b)})`,
        `${fs}.unlinkSync(${JSON.stringify(a)})`,
        `${fs}.openSync(${JSON.stringify(b)}, 'w')`,
        "new (process.getBuiltinModule('node:worker_threads').Worker)('0', { eval: true })",
        "process.dlopen({ exports: {} }, '/nonexistent/a.node')",
        "process.getBuiltinModule('node:inspector').open()",
        "new (process.getBuiltinModule('node:wasi').WASI)({ version: 'preview1' })",
      ];
      for (const call of calls) {
        const out = await run(`${call};\nexport const n = 1;`);
        expect(failureOf(out)?.code, `${call}: ${JSON.stringify(out)}`).toBe("E1050");
      }
      expect(readdirSync(other).sort()).toEqual(["a.txt"]);
    },
    testTime(120_000),
  );
});

describe("k.evaluator: the command ends the evaluator", () => {
  test(
    "`evaluate` of an entry holding `setInterval(() => {}, 10); export const n = 1` resolves to `{ n: 1 }`, and the child has exited",
    async () => {
      expect(await run("setInterval(() => {}, 10); export const n = 1")).toEqual({ n: 1 });
    },
    BOUND,
  );

  test(
    "`evaluate` of an entry whose top level is `await new Promise(() => {})` resolves within 5 s to a failure whose code is E1048 and whose message ends `a top-level await never settles`",
    async () => {
      const f = failureOf(await run("await new Promise(() => {})"));
      expect(f?.code).toBe("E1048");
      expect(f?.message.endsWith("a top-level await never settles"), f?.message).toBe(true);
    },
    FIVE,
  );

  test.each([
    ["`for (;;) {}`", "for (;;) {}"],
    [
      "`setInterval(() => {}, 10); await new Promise(() => {})`",
      "setInterval(() => {}, 10); await new Promise(() => {})",
    ],
  ])(
    "`evaluate` given `deadlineMs: 200` and an entry whose top level is %s resolves within 5 s to a failure whose code is E1048 and whose message ends `in 200 ms`, and the child has exited",
    async (_name, source) => {
      const f = failureOf(await run(source, 200));
      expect(f?.code).toBe("E1048");
      expect(f?.message.endsWith("in 200 ms"), f?.message).toBe(true);
    },
    FIVE,
  );

  test(
    "`evaluate` of an entry whose top level calls `process.exit(3)` resolves to a failure whose code is E1049 and whose message ends `the evaluator ended with exit 3`",
    async () => {
      const f = failureOf(await run("process.exit(3)"));
      expect(f?.code).toBe("E1049");
      expect(f?.message.endsWith("the evaluator ended with exit 3"), f?.message).toBe(true);
    },
    BOUND,
  );

  test(
    "`evaluate` of an entry whose top level calls `process.abort()` resolves to a failure whose code is E1049 and whose message ends `with signal SIGABRT`",
    async () => {
      const f = failureOf(await run("process.abort()"));
      expect(f?.code).toBe("E1049");
      expect(f?.message.endsWith("with signal SIGABRT"), f?.message).toBe(true);
    },
    BOUND,
  );
});

// UNTESTABLE here: "the child has exited" beyond the resolved value (the child's pid is not exposed by `evaluate`); "no `keel` command gives a `deadlineMs`" (30,000 unless given) needs a 30 s wait and is asserted through the CLI files' bounds instead.
