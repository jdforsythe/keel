// Also states, k.compiler Build-time evaluation: "It reads through views (k.evaluator), by any name (`globalThis.process`, `global`, an alias, `createRequire`, `process.getBuiltinModule`); each module's `import.meta` is its own."
// Also states, k.evaluator Questions: "`console`, `process.stdout`, `process.stderr`, `process` listeners and `util` warnings write nowhere, and the command discards what the evaluator's own output streams carry, Node's warnings among it."
// Also states, k.compiler Build-time evaluation: "Observed: each question of k.check-cache Evaluation probes, with its answer."
// Also states, k.check-cache Evaluation probes: "A build-time evaluation (k.compiler Build-time evaluation) records, besides its inputs (k.derived Derivation cache): each lookup of its resolver and of `require` (each candidate file, `node_modules/<name>`, `package.json` and `tsconfig.json` `paths` target tried up to the one that answers, all for a name resolving to nothing) and each loaded file's nearest `package.json` and `tsconfig.json` (and its `extends`); each `node:fs` open for reading, existence test, stat (kind, size, mode), real path and listing, promised too; each field of a stat result the code reads (`mtimeMs`, `ino`), by its value; each `process.env` name; each stable fact of `process`, `os`, `tty` and `navigator` read or called (`cwd()`), with its arguments; and always the working folder, Node's version and the default locale and time zone, which `Date` and `Intl` read."
// Seed 1337 (recorded); no random inputs. The household copy of derived-support.ts, built once and cloned per case; the `*.server.ts` file is `modules/setup/gate.guard.ts` (derived-cache-observed-support.ts).
// `createRequire(import.meta.url)` of `./m.json` resolves from the requiring module's folder: for the guard file `modules/setup`, for a package's file the package's folder; a bundle-wide `import.meta` would resolve from one folder for both.
// The fact read is `os.homedir()`, which a case changes through `HOME` (the call's answer differs, its arguments do not); a hit (`counts.cached` 1) is the control. `HOME` is a folder of the copy.
// "Writes nothing to `keel check`'s output" is read as: the marker text is in neither stdout nor stderr of `keel check`.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fixedTime } from "@keel/tooling/test-time";
import { afterAll, describe, expect, test } from "vitest";
import { e1050Raw, pkg, writeAt } from "./derived-cache-loader-support.ts";
import { guardFile } from "./derived-cache-observed-support.ts";
import { type Tree, brief, cloneTree, dropTree, householdTree, keel, read } from "./derived-support.ts";

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

describe("k.compiler: each module's `import.meta` is its own", () => {
  test(
    "`createRequire(import.meta.url)` of `./m.json` in the guard file resolves from that file's folder and is no E1050",
    () => {
      const t = copy();
      writeAt(t.dir, "modules/setup/m.json", '{"min":1}\n');
      guardFile(
        t,
        'import { createRequire } from "node:module";\nconst m = createRequire(import.meta.url)("./m.json");',
        'Reflect.get(m, "min") === 1 ? "members.signin" : "app.start"',
      );
      const out = keel(t.dir, ["check"]);
      expect(e1050Raw(out), brief(out)).toEqual([]);
      expect(out.status, brief(out)).toBe(0);
      expect(read(t.dir, ".keel/routes.json")).toContain("members.signin");
    },
    SLOW,
  );

  test(
    "`createRequire(import.meta.url)` of `./data.json` in a package's file resolves from the package's folder and is no E1050",
    () => {
      const t = copy();
      const dir = pkg(
        t,
        "rq-like",
        "index.mjs",
        'import { createRequire } from "node:module";\nexport default createRequire(import.meta.url)("./data.json");\n',
        "declare const x: { min: number };\nexport default x;\n",
      );
      writeAt(dir, "data.json", '{"min":1}\n');
      guardFile(t, 'import data from "rq-like";', 'data.min === 1 ? "members.signin" : "app.start"');
      const out = keel(t.dir, ["check"]);
      expect(e1050Raw(out), brief(out)).toEqual([]);
      expect(out.status, brief(out)).toBe(0);
      expect(read(t.dir, ".keel/routes.json")).toContain("members.signin");
    },
    SLOW,
  );
});

describe("k.compiler: `console`, `process.stdout` and `process.stderr` write nowhere", () => {
  test.each([
    ["console.log", 'console.log("KEEL-MARK-A");'],
    ["console.error", 'console.error("KEEL-MARK-B");'],
    ["process.stdout.write", 'process.stdout.write("KEEL-MARK-C\\n");'],
    ["process.stderr.write", 'process.stderr.write("KEEL-MARK-D\\n");'],
  ])(
    "`%s` in the evaluation writes nothing to the output of `keel check`",
    (_name, call) => {
      const t = copy();
      guardFile(t, call);
      const out = keel(t.dir, ["check"]);
      expect(e1050Raw(out), brief(out)).toEqual([]);
      expect(out.stdout + out.stderr).not.toContain("KEEL-MARK");
    },
    SLOW,
  );
});

describe("k.compiler: each call of `node:os` is recorded with its answer", () => {
  const REDIRECT = 'homedir().endsWith("h1") ? "members.signin" : "app.start"';
  const warm = (): { t: Tree; first: string } => {
    const t = copy();
    for (const h of ["h1", "h2"]) mkdirSync(join(t.base, h), { recursive: true });
    guardFile(t, 'import { homedir } from "node:os";', REDIRECT);
    const out = keel(t.dir, ["check"], { HOME: join(t.base, "h1") });
    expect(e1050Raw(out), brief(out)).toEqual([]);
    expect(out.status, brief(out)).toBe(0);
    const first = read(t.dir, ".keel/routes.json");
    expect(first).toContain("members.signin");
    return { t, first };
  };

  test(
    "after one `keel check`, a `keel check` whose `os.homedir()` answers differently has `counts.evaluated` 1",
    () => {
      const { t, first } = warm();
      const out = keel(t.dir, ["check"], { HOME: join(t.base, "h2") });
      expect(out.counts.evaluated, brief(out)).toBe(1);
      expect(out.counts.cached, brief(out)).toBe(0);
      expect(read(t.dir, ".keel/routes.json")).not.toBe(first);
      expect(read(t.dir, ".keel/routes.json")).toContain("app.start");
    },
    SLOW,
  );

  test(
    "after one `keel check`, a `keel check` whose `os.homedir()` answers the same is a hit: `counts.evaluated` 0 and `counts.cached` 1",
    () => {
      const { t } = warm();
      const out = keel(t.dir, ["check"], { HOME: join(t.base, "h1") });
      expect(out.counts.evaluated, brief(out)).toBe(0);
      expect(out.counts.cached, brief(out)).toBe(1);
    },
    SLOW,
  );
});
