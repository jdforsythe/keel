// Spec: k.unsafe, clause "`keel ledger --write` of a fixture whose `packages/p/unsafe/a.ts` holds two `unsafe(` calls and one in a comment, whose `packages/p/unsafe/unsafe.ts` declares `function unsafe<T>(`, and whose `packages/p/test/a.test-d.ts` holds three expectations writes `unsafe: 2` and `negativeTypes: 3`; then a fourth expectation makes `--diff` report no E1706, and a third call makes it report E1706."
// Spec: k.unsafe, clause "A clause cited by the `// Spec:` header of `packages/p/conformance/a.test-d.ts` alone is `none` in `keel ledger`."
// Seed 1337 (the property below). The real `keel` binary over temp projects in the OS tmpdir; the ledger file is read as
// JSON. Directive and call text is built from constants so this file holds neither. Spec ambiguities: the value form of
// `--scope` is not written in k.unsafe; the scope case passes the app folder as a path prefix (as ledger-host-elements does),
// and that an app is a folder under `apps/` is read from "every file of `apps/*`".
import { fixedTime } from "@keel/tooling/test-time";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { afterAll, describe, expect, it } from "vitest";
import { ledgerRecord } from "./ledger-fixture-kinds.ts";
import { itemOf } from "./ledger-items-support.ts";
import { type Run, keel, makeProject, removeProject, summaryOf, writeFiles } from "./test-sim-project.ts";

const COMMITTED = ".keel/ledger.json";
const U = "unsafe";
const EXPECT = `@ts-${"expect-error"}`;
const IGNORE = `@ts-${"ignore"}`;
const SEED = 1337;

const created: string[] = [];
afterAll(() => {
  for (const d of created.splice(0)) removeProject(d);
});
const project = (prefix: string, files: Readonly<Record<string, string>>): string => {
  const dir = makeProject(prefix, files);
  created.push(dir);
  return dir;
};
const written = (dir: string, path = COMMITTED): Record<string, unknown> => {
  const v: unknown = JSON.parse(readFileSync(join(dir, path), "utf8"));
  return typeof v === "object" && v !== null ? Object.fromEntries(Object.entries(v)) : {};
};
const e1706 = (run: Run): unknown[] => run.records.filter((r) => r.kind === "diag" && r.code === "E1706");

/** `n` described expectations, each above a line that does not compile. */
const expectations = (n: number, tag = "a"): string =>
  Array.from(
    { length: n },
    (_, i) => `// ${EXPECT} the ${tag} case ${i} is no string\nexport const ${tag}${i}: string = ${i};\n`,
  ).join("");

const helper = `export function ${U}<T>(reason: string, fn: () => T): T {\n  return fn();\n}\n`;
const REASON = "one two three four five six seven eight";
const calls = (n: number): string =>
  `import { ${U} } from "./${U}.ts";\n// ${U}("${REASON}", () => 0) in a comment is no call\n` +
  Array.from({ length: n }, (_, i) => `export const c${i} = ${U}("${REASON}", () => ${i});\n`).join("");

const FIXTURE = {
  [`packages/p/${U}/a.ts`]: calls(2),
  [`packages/p/${U}/${U}.ts`]: helper,
  "packages/p/test/a.test-d.ts": expectations(3),
};

describe("k.unsafe Ledger: `unsafe` and `negativeTypes`", () => {
  const dir = project("ledger-negtypes", FIXTURE);

  it(
    "`keel ledger --write` of a fixture whose `packages/p/unsafe/a.ts` holds two `unsafe(` calls and one in a comment, whose `packages/p/unsafe/unsafe.ts` declares `function unsafe<T>(`, and whose `packages/p/test/a.test-d.ts` holds three expectations writes `unsafe: 2` and `negativeTypes: 3`",
    () => {
      const run = keel(dir, ["ledger", "--write", COMMITTED]);
      expect(run.status).toBe(0);
      const led = written(dir);
      expect(led.unsafe).toBe(2);
      expect(led.negativeTypes).toBe(3);
    },
    fixedTime(60_000),
  );

  it("`negativeTypes` is an integer at the ledger file's top level, right after `hostElements`", () => {
    const keys = Object.keys(written(dir));
    expect(keys.indexOf("hostElements")).toBeGreaterThanOrEqual(0);
    expect(keys.indexOf("negativeTypes")).toBe(keys.indexOf("hostElements") + 1);
  });

  it(
    "then a fourth expectation makes `--diff` report no E1706",
    () => {
      writeFiles(dir, { "packages/p/test/a.test-d.ts": expectations(4) });
      const diff = keel(dir, ["ledger", "--diff"]);
      expect(e1706(diff)).toEqual([]);
      expect(diff.status).toBe(0);
      expect(summaryOf(diff)).toMatchObject({ ok: true });
    },
    fixedTime(60_000),
  );

  it(
    "and removing expectations makes `--diff` report no E1706: the count is never compared",
    () => {
      writeFiles(dir, { "packages/p/test/a.test-d.ts": expectations(1) });
      expect(e1706(keel(dir, ["ledger", "--diff"]))).toEqual([]);
      writeFiles(dir, { "packages/p/test/a.test-d.ts": expectations(3) });
    },
    fixedTime(60_000),
  );

  it(
    "a third call makes `--diff` report E1706",
    () => {
      writeFiles(dir, { [`packages/p/${U}/a.ts`]: calls(3) });
      const diff = keel(dir, ["ledger", "--diff"]);
      expect(diff.status).toBe(1);
      expect(e1706(diff)).toHaveLength(1);
    },
    fixedTime(60_000),
  );
});

describe("k.unsafe Ledger: what `negativeTypes` counts", () => {
  it(
    "property: it is the number of described expectations in the `*.test-d.ts(x)` files under `test/` and `conformance/` of `packages/*`",
    () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 4 }),
          fc.integer({ min: 0, max: 4 }),
          fc.integer({ min: 0, max: 3 }),
          (inTest, inConformance, inTsx) => {
            const dir = project("ledger-negtypes-count", {
              "packages/p/test/a.test-d.ts": expectations(inTest, "a"),
              "packages/p/conformance/b.test-d.ts": expectations(inConformance, "b"),
              "packages/q/test/c.test-d.tsx": expectations(inTsx, "c"),
            });
            expect(keel(dir, ["ledger", "--write", COMMITTED]).status).toBe(0);
            expect(written(dir).negativeTypes).toBe(inTest + inConformance + inTsx);
          },
        ),
        { seed: SEED, numRuns: 5 },
      );
    },
    fixedTime(120_000),
  );

  it(
    "a bare directive, `@ts-ignore`, and a directive in a file that is not a negative type test are not expectations",
    () => {
      const dir = project("ledger-negtypes-not", {
        "packages/p/test/a.test-d.ts": `${expectations(2)}// ${EXPECT}\nexport const bare: string = 1;\n// ${IGNORE} the line below is ignored\nexport const ig: string = 1;\n`,
        "packages/p/test/b.test.ts": expectations(3, "b"),
      });
      expect(keel(dir, ["ledger", "--write", COMMITTED]).status).toBe(0);
      expect(written(dir).negativeTypes).toBe(2);
    },
    fixedTime(60_000),
  );

  it(
    "it counts the expectations of `apps/*` and an app's `test/` and `modules/`; with `--scope`, the apps in scope",
    () => {
      const dir = project("ledger-negtypes-apps", {
        "packages/p/test/a.test-d.ts": expectations(3, "a"),
        "apps/x/test/b.test-d.ts": expectations(2, "b"),
        "apps/x/modules/m/test/c.test-d.ts": expectations(1, "c"),
      });
      expect(keel(dir, ["ledger", "--write", COMMITTED]).status).toBe(0);
      expect(written(dir).negativeTypes).toBe(6);
      const scoped = keel(dir, ["ledger", "--write", "scoped.json", "--scope", "apps/x/"]);
      expect(scoped.status).toBe(0);
      expect(written(dir, "scoped.json").negativeTypes).toBe(3);
      expect(e1706(scoped)).toEqual([]);
    },
    fixedTime(60_000),
  );

  it(
    "an expectation is no `unsafe` call: one call and five expectations write `unsafe: 1` and `negativeTypes: 5`",
    () => {
      const dir = project("ledger-negtypes-home", {
        [`packages/p/${U}/a.ts`]: calls(1),
        [`packages/p/${U}/${U}.ts`]: helper,
        "packages/p/test/a.test-d.ts": expectations(5),
      });
      expect(keel(dir, ["ledger", "--write", COMMITTED]).status).toBe(0);
      expect(written(dir)).toMatchObject({ unsafe: 1, negativeTypes: 5 });
    },
    fixedTime(60_000),
  );
});

describe("k.unsafe Ledger: no item evidence", () => {
  const SPEC = "spec/kernel/k.fx.md";
  const CLAUSE = "A call that does not compile is an error.";
  const specText = ["# k.fx: Fixture", "status: conformance-covered", "", "**Conformance.**", `- ${CLAUSE}`, ""].join(
    "\n",
  );
  const header = `// Spec: k.fx, clause "${CLAUSE}"\n`;
  const rung = (files: Readonly<Record<string, string>>): unknown => {
    const dir = project("ledger-negtypes-rung", { [SPEC]: specText, ...files });
    return ledgerRecord(keel(dir, ["ledger"]), itemOf("k.fx", CLAUSE))?.rung;
  };

  it(
    "A clause cited by the `// Spec:` header of `packages/p/conformance/a.test-d.ts` alone is `none` in `keel ledger`",
    () => {
      expect(rung({ "packages/p/conformance/a.test-d.ts": `${header}${expectations(1)}` })).toBe("none");
    },
    fixedTime(60_000),
  );

  it(
    "control: the same header in a conformance file that runs and passes gives the clause a rung above `none`",
    () => {
      const runs = `${header}import { expect, it } from "vitest";\nit("holds", () => {\n  expect(1 + 1).toBe(2);\n});\n`;
      expect(rung({ "packages/p/conformance/a.test.ts": runs })).toBe("example");
    },
    fixedTime(60_000),
  );

  it(
    "a negative type test beside a passing citing file adds no rung: the run-time half decides",
    () => {
      const runs = `${header}import { expect, it } from "vitest";\nit("holds", () => {\n  expect(1 + 1).toBe(2);\n});\n`;
      const both = rung({
        "packages/p/conformance/a.test.ts": runs,
        "packages/p/conformance/a.test-d.ts": `${header}${expectations(1)}`,
      });
      expect(both).toBe("example");
    },
    fixedTime(60_000),
  );
});
