// Spec: k.evaluator, clause "In `G` with `index.mjs` line 1 `import os from 'node:os'`, line 2 `Error.stackTraceLimit = 0` and line 3 `export default String(os.cpus())`, `keel check` reports one E1050 whose message starts `node:os.cpus at p/index.mjs:3`."
// Spec: k.evaluator, clause "In `G` with `index.mjs` the one line `import os from 'node:os'; export default String(os.cpus())`, `keel check` reports one E1050 whose message starts `node:os.cpus at p/index.mjs:1:` followed by a column greater than 26."
// Spec: k.evaluator, clause "In `G` with `index.mjs` line 1 `import os from 'node:os'` and line 2 `try { os.cpus() } catch (e) { throw new Error('wrapped: ' + e.message) }`, `keel check` reports one E1006 whose message holds `wrapped: node:os.cpus`, and no byte of its stdout is below 0x20 but the line feed; while `keel dev` serves `G` with line 2 `export default String(os.cpus())`, its output holds the E1050 line `keel check` prints for that tree."
// Spec: k.evaluator, clause "In `G` with `index.mjs` line 2 `await import('data:text/javascript,' + encodeURIComponent('export default 1'))`, `keel check` reports one E1050 with no `path` whose message holds ` at p/index.mjs:2`."
// Also states, k.evaluator Placing: "A diagnostic crosses from the evaluator as a record of fields (its code, its message, the bundle positions of its frames, the entry file being evaluated), never as marks in text; the command maps positions through the bundle's source map, whatever the code did to `Error.stackTraceLimit` or `Error.prepareStackTrace`. A refusal reaches evaluated code as a thrown `Error` whose message starts with what was refused. E1050 is placed as k.compiler Rules says; a frame in a module that is no file on disk (a `data:` URL) is skipped. E1048 and E1049 lie at the entry file whose import had not finished (`tokens.ts`, a contract file or a `routes.ts`), with no line. No message from an evaluation holds a control character, the bundle's path or a line of Node's own output. `keel dev` prints each as `keel check` does and keeps serving."
// Also states, k.evaluator End: "The command also ends it, with no result: `deadlineMs` after its start by the command's monotonic clock (30,000 unless given; no `keel` command gives one), E1048; when Node ends it because a top-level await can never settle, E1048; when it exits or is killed any other way, E1049; when the command itself exits or is interrupted."
// Seed 1337 (recorded) for the one property. The household copy of derived-support.ts, built once and cloned per case (`G` of k.evaluator Conformance; evaluator-support.ts `gFixture`, `p`'s `index.mjs` as each case gives, lines counted from 1).
// ASSUMED: a column "greater than 26" is read on the first line `import os from 'node:os'; export default String(os.cpus())` as the number after `index.mjs:1:` (`os.cpus()` begins at column 52 of that line; the clause only bounds it below).
// ASSUMED: a bundle's `process.exit(<n>)` is E1049 (k.evaluator End: "when it exits or is killed any other way, E1049") or a refusal of the call (E1050: the banner's view of `process` may not list `exit`; only an entry `evaluate` runs directly has Node's own, k.evaluator Conformance note); either way no byte of Node's reaches the output. No other early exit is reachable from app or package code without exhausting memory: UNTESTABLE through the CLI beyond this and the bundling failure.
// ASSUMED: "the E1050 line `keel check` prints" is the first line of `keel check --format=compact` that starts `E1050 `, and `keel dev`'s output holding that line verbatim is "prints each as `keel check` does".
import { testTime } from "@keel/tooling/test-time";
import fc from "fast-check";
import { afterAll, describe, expect, test } from "vitest";
import { type Out, type Tree, brief, cloneTree, dropTree, householdTree, put, read, until } from "./derived-support.ts";
import { type Dev, gFixture, keelBounded, recordsOf, startDev, text } from "./evaluator-support.ts";

const SLOW = testTime(600_000);
const RUN = 60_000;

let house: Tree | undefined;
const made: Tree[] = [];
const devs: Dev[] = [];
afterAll(() => {
  for (const d of devs) d.stop();
  for (const t of made) dropTree(t);
});
const copy = (): Tree => {
  house ??= householdTree();
  if (!made.includes(house)) made.push(house);
  const t = cloneTree(house);
  made.push(t);
  return t;
};

/** Control characters other than the line feed, found in `s`. */
const controls = (s: string): string[] => [...s].filter((c) => c.charCodeAt(0) < 0x20 && c !== "\n");

describe("k.evaluator: a refusal is placed from the source map, whatever the code did to the stack", () => {
  test(
    "in `G` with `index.mjs` line 1 `import os from 'node:os'`, line 2 `Error.stackTraceLimit = 0` and line 3 `export default String(os.cpus())`, `keel check` reports one E1050 whose message starts `node:os.cpus at p/index.mjs:3`",
    () => {
      const t = copy();
      gFixture(t, "import os from 'node:os'\nError.stackTraceLimit = 0\nexport default String(os.cpus())\n");
      const out = keelBounded(t.dir, ["check"], RUN);
      const found = recordsOf(out, "E1050");
      expect(found, brief(out)).toHaveLength(1);
      expect(text(found[0]).startsWith("node:os.cpus at p/index.mjs:3"), text(found[0])).toBe(true);
      expect(out.status, brief(out)).toBe(1);
    },
    SLOW,
  );

  test(
    "in `G` with `index.mjs` the one line `import os from 'node:os'; export default String(os.cpus())`, `keel check` reports one E1050 whose message starts `node:os.cpus at p/index.mjs:1:` followed by a column greater than 26",
    () => {
      const t = copy();
      gFixture(t, "import os from 'node:os'; export default String(os.cpus())\n");
      const out = keelBounded(t.dir, ["check"], RUN);
      const found = recordsOf(out, "E1050");
      expect(found, brief(out)).toHaveLength(1);
      const m = /^node:os\.cpus at p\/index\.mjs:1:(\d+)/.exec(text(found[0]));
      expect(m, text(found[0])).not.toBeNull();
      expect(Number(m?.[1])).toBeGreaterThan(26);
    },
    SLOW,
  );

  test(
    "in `G` with `index.mjs` line 1 `import os from 'node:os'` and line 2 `try { os.cpus() } catch (e) { throw new Error('wrapped: ' + e.message) }`, `keel check` reports one E1006 whose message holds `wrapped: node:os.cpus`, and no byte of its stdout is below 0x20 but the line feed",
    () => {
      const t = copy();
      gFixture(
        t,
        "import os from 'node:os'\ntry { os.cpus() } catch (e) { throw new Error('wrapped: ' + e.message) }\nexport default 1\n",
      );
      const out = keelBounded(t.dir, ["check", "--format=compact"], RUN);
      const json = keelBounded(t.dir, ["check"], RUN);
      const found = recordsOf(json, "E1006");
      expect(found, brief(json)).toHaveLength(1);
      expect(text(found[0]).includes("wrapped: node:os.cpus"), text(found[0])).toBe(true);
      expect(controls(out.stdout), "control bytes of the compact stdout").toEqual([]);
    },
    SLOW,
  );

  test(
    "while `keel dev` serves `G` with `index.mjs` line 2 `export default String(os.cpus())`, its output holds the E1050 line `keel check` prints for that tree",
    async () => {
      const t = copy();
      gFixture(t, "import os from 'node:os'\nexport default String(os.cpus())\n");
      const compact = keelBounded(t.dir, ["check", "--format=compact"], RUN);
      const line = compact.stdout.split("\n").find((l) => l.startsWith("E1050 "));
      expect(line, compact.stdout).toBeDefined();
      const dev = await startDev(t.dir, 120_000);
      devs.push(dev);
      const printed = await until(() => dev.output().includes(line ?? "\0"), testTime(60_000));
      expect(printed, dev.output()).toBe(true);
      dev.stop();
    },
    SLOW,
  );

  test(
    "in `G` with `index.mjs` line 2 `await import('data:text/javascript,' + encodeURIComponent('export default 1'))`, `keel check` reports one E1050 with no `path` whose message holds ` at p/index.mjs:2`",
    () => {
      const t = copy();
      gFixture(
        t,
        "const keep = 1; void keep;\nawait import('data:text/javascript,' + encodeURIComponent('export default 1'))\nexport default 1\n",
      );
      const out = keelBounded(t.dir, ["check"], RUN);
      const found = recordsOf(out, "E1050");
      expect(found, brief(out)).toHaveLength(1);
      expect(found[0]?.path, "an E1050 in a package has no path").toBeUndefined();
      expect(text(found[0]).includes(" at p/index.mjs:2"), text(found[0])).toBe(true);
    },
    SLOW,
  );
});

describe("k.evaluator: an evaluator that ends early is E1049 at the entry file, and nothing of Node's reaches the output", () => {
  const clean = (o: Out): void => {
    expect(controls(o.stdout + o.stderr), "control bytes").toEqual([]);
    expect(o.stdout + o.stderr).not.toMatch(/Node\.js v\d|ERR_[A-Z_]+|node:internal|\0/);
  };

  test(
    "a package whose top level calls `process.exit(n)` gives one E1049 at a contract file or `routes.ts` of `modules/setup` with no line, whose message ends `the evaluator ended with exit <n>`, or one E1050 refusing the call; no output byte below 0x20 but the line feed, and no line of Node's own, reaches compact or JSON output",
    () => {
      fc.assert(
        fc.property(fc.constantFrom(3, 7, 42), (n) => {
          // seed 1337
          const t = copy();
          gFixture(t, `export default 1;\nprocess.exit(${String(n)});\n`);
          const json = keelBounded(t.dir, ["check"], RUN);
          const compact = keelBounded(t.dir, ["check", "--format=compact"], RUN);
          const ended = recordsOf(json, "E1049");
          const refused = recordsOf(json, "E1050");
          expect(ended.length + refused.length, brief(json)).toBe(1);
          if (ended.length === 1) {
            const path = ended[0]?.path;
            expect(
              typeof path === "string" && /^modules\/setup\/(?:[^/]+\.contract\.ts|routes\.ts)$/.test(path),
              String(path),
            ).toBe(true);
            expect(ended[0]?.line).toBeUndefined();
            expect(text(ended[0]).endsWith(`the evaluator ended with exit ${String(n)}`), text(ended[0])).toBe(true);
          }
          expect(json.status, brief(json)).toBe(1);
          clean(json);
          clean(compact);
        }),
        { seed: 1337, numRuns: 3 },
      );
    },
    SLOW,
  );

  test(
    "a `routes.ts` whose first line imports a file that does not exist gives one E1049, and no output byte below 0x20 but the line feed, and no line of Node's own, reaches compact or JSON output",
    () => {
      const t = copy();
      gFixture(t, "export default 1\n");
      put(t.dir, "modules/setup/routes.ts", `import "./missing.ts";\n${read(t.dir, "modules/setup/routes.ts")}`);
      const json = keelBounded(t.dir, ["check"], RUN);
      const compact = keelBounded(t.dir, ["check", "--format=compact"], RUN);
      expect(recordsOf(json, "E1049"), brief(json)).toHaveLength(1);
      clean(json);
      clean(compact);
    },
    SLOW,
  );
});
