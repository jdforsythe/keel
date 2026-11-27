// Spec: k.compiler, clause "In the copy of k.derived clause 30 with `line`'s default `min` read from `globalThis.process.env.LINE_MIN`, from `global.process.env.LINE_MIN`, from `env.LINE_MIN` after `const { env } = process`, or from `process.getBuiltinModule('node:process').env.LINE_MIN`, a `keel check` with `LINE_MIN=2` after one with `LINE_MIN=1` has `counts.evaluated` 1."
// Spec: k.compiler, clause "In the copy of k.derived clause 30 with `min.txt` read through `openSync` and `readSync`, or `min.json` read by `createRequire(import.meta.url)` of a name built at run time, after one `keel check`, changing that file's bytes, its modification time kept, makes the next `keel check` have `counts.evaluated` 1." (the clause as k.compiler states it)
// Also states, k.derived Derivation cache: "`node:fs`, `process` and `require` are seen by any name (`globalThis.process`, `global`, an alias, `createRequire`, `process.getBuiltinModule`); nothing global changes."
// Seed 1337 (recorded); no random inputs. The household copy of derived-support.ts, built once and cloned per case; a file is written with its old modification time so only the bytes tell.
// The `.json` name is built from the absolute path of the file (Node resolves no bare name to a sibling).
// "Clause 30" is the clause of k.derived that reads `min.txt` with `readFileSync` and `process.env.LINE_MIN` (derived-cache-keyed-reads.test.ts); the env reads sit in the linked `@keel/std-text` `line`, the file reads in `modules/setup/gate.guard.ts`
// (derived-cache-observed-support.ts), whose redirect `routes.json` holds. Each case is a miss when the read thing changes and a hit (`counts.cached` 1) when it does not.
import { fixedTime } from "@keel/tooling/test-time";
import { afterAll, describe, expect, test } from "vitest";
import { join } from "node:path";
import { REDIRECT, guardFile, putOld } from "./derived-cache-observed-support.ts";
import { lineSurface } from "./derived-cache-support.ts";
import { type Tree, brief, cloneTree, dropTree, editStdText, householdTree, keel, read } from "./derived-support.ts";

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
const lineMin = (n: number): Record<string, string> => ({ LINE_MIN: String(n) });

describe.each([
  ["globalThis.process.env.LINE_MIN", 'Number(globalThis.process.env.LINE_MIN ?? "1")'],
  ["global.process.env.LINE_MIN", 'Number(global.process.env.LINE_MIN ?? "1")'],
  [
    "env.LINE_MIN after `const { env } = process`",
    'Number((() => { const { env } = process; return env.LINE_MIN ?? "1"; })())',
  ],
  [
    "process.getBuiltinModule('node:process').env.LINE_MIN",
    "Number(process.getBuiltinModule('node:process').env.LINE_MIN ?? \"1\")",
  ],
])("k.derived: `line`'s default `min` read from %s", (_name, expr) => {
  /** A copy whose `line` reads `expr`, after one `keel check` with `LINE_MIN=1`. */
  const warm = (): Tree => {
    const t = copy();
    editStdText(t, "min ?? 1", `min ?? ${expr}`, false);
    const first = keel(t.dir, ["check"], lineMin(1));
    expect(first.status, brief(first)).toBe(0);
    expect(read(t.dir, ".keel/surface.json")).toContain(lineSurface(1));
    return t;
  };

  test(
    "a `keel check` with `LINE_MIN=2` after one with `LINE_MIN=1` has `counts.evaluated` 1",
    () => {
      const t = warm();
      const out = keel(t.dir, ["check"], lineMin(2));
      expect(out.counts.evaluated, brief(out)).toBe(1);
      expect(out.counts.cached, brief(out)).toBe(0);
      expect(read(t.dir, ".keel/surface.json")).toContain(lineSurface(2));
    },
    SLOW,
  );

  test(
    "a `keel check` with `LINE_MIN=1` again is a hit: `counts.evaluated` 0 and `counts.cached` 1",
    () => {
      const t = warm();
      const out = keel(t.dir, ["check"], lineMin(1));
      expect(out.counts.evaluated, brief(out)).toBe(0);
      expect(out.counts.cached, brief(out)).toBe(1);
    },
    SLOW,
  );
});

type Reader = {
  name: string;
  /** The file read, in the project. */
  file: string;
  /** Its bytes while the value is `v`. */
  bytes: (v: string) => string;
  /** The source of `gate.guard.ts` up to the guard: it defines `MIN_TEXT`. */
  source: (t: Tree) => string;
};
const abs = (t: Tree, rel: string): string => JSON.stringify(join(t.dir, rel));
const MODULE = 'import { createRequire } from "node:module";\n';
const READERS: readonly Reader[] = [
  {
    name: "`process.getBuiltinModule('node:fs').readFileSync`",
    file: "min.txt",
    bytes: (v) => v,
    source: (t) =>
      `const MIN_TEXT: string = process.getBuiltinModule("node:fs").readFileSync(${abs(t, "min.txt")}, "utf8");`,
  },
  {
    name: "`createRequire(import.meta.url)('node:fs')`",
    file: "min.txt",
    bytes: (v) => v,
    source: (t) =>
      `${MODULE}const MIN_TEXT: string = createRequire(import.meta.url)("node:fs").readFileSync(${abs(t, "min.txt")}, "utf8");`,
  },
  {
    name: "`min.json` read by `createRequire(import.meta.url)` of a name built at run time",
    file: "modules/setup/min.json",
    bytes: (v) => `{"min":${v}}\n`,
    source: (t) =>
      `${MODULE}const MIN_TEXT = String(createRequire(import.meta.url)([${abs(t, "modules/setup/min")}, "json"].join(".")).min);`,
  },
  {
    name: "`min.txt` read through `openSync` and `readSync`",
    file: "min.txt",
    bytes: (v) => v,
    source: (t) =>
      `import { closeSync, openSync, readSync } from "node:fs";\nconst fd = openSync(${abs(t, "min.txt")}, "r");\nconst buf = Buffer.alloc(1);\nreadSync(fd, buf, 0, 1, 0);\ncloseSync(fd);\nconst MIN_TEXT = buf.toString("utf8");`,
  },
];

describe.each(READERS)("k.derived: $name", (r) => {
  /** A copy whose guard of `setup.form` reads the file at value `1`, after one `keel check`. */
  const warm = (): { t: Tree; first: string } => {
    const t = copy();
    putOld(t, r.file, r.bytes("1"));
    guardFile(t, r.source(t), REDIRECT);
    const out = keel(t.dir, ["check"]);
    expect(out.status, brief(out)).toBe(0);
    const first = read(t.dir, ".keel/routes.json");
    expect(first).toContain("members.signin");
    return { t, first };
  };

  test(
    "after one `keel check`, changing that file's bytes, its modification time kept, makes the next `keel check` have `counts.evaluated` 1",
    () => {
      const { t, first } = warm();
      putOld(t, r.file, r.bytes("2"));
      const out = keel(t.dir, ["check"]);
      expect(out.counts.evaluated, brief(out)).toBe(1);
      expect(out.counts.cached, brief(out)).toBe(0);
      expect(read(t.dir, ".keel/routes.json")).not.toBe(first);
      expect(read(t.dir, ".keel/routes.json")).toContain("app.start");
    },
    SLOW,
  );

  test(
    "rewriting that file with the same bytes is a hit: `counts.evaluated` 0 and `counts.cached` 1",
    () => {
      const { t, first } = warm();
      putOld(t, r.file, read(t.dir, r.file));
      const out = keel(t.dir, ["check"]);
      expect(out.counts.evaluated, brief(out)).toBe(0);
      expect(out.counts.cached, brief(out)).toBe(1);
      expect(read(t.dir, ".keel/routes.json")).toBe(first);
    },
    SLOW,
  );
});
