// k.ledger, File: "`keel ledger --write <file>` writes `{ version, unsafe, hostElements, negativeTypes, rungs, mutation, exports, clauses, a11y, libraries }`, keys in that order, as `JSON.stringify(value, null, 2)` and a line feed. `version` is 1; `unsafe`, `hostElements` and `negativeTypes` (k.unsafe; no file under `node_modules/` counted) are counts; `rungs` is `{ example, probabilistic, exhaustive, proven, monitored }`; `mutation`, written only when it holds a package or a claim, is `{ packages, claims }`, `packages` keyed by package folder name, each `{ score, scoreJustified, threshold, killed, survived, noCoverage, justified }` (`score` and `scoreJustified` percents to two decimals, absent while the package has no fresh mutant), `claims` `[{ file, sha, killed, survived, noCoverage, justified, score }]` (Mutation) ordered by `file`; `exports` is `[{ pkg, name, file, rung }]` ordered by `<file>#<name>`, `file` a package export's repository path, an app export's `<app>:<path under modules/>`, a library's path from its folder (k.library-pack Own folder), and `pkg` the package's or app's folder name or the library's `id`; `clauses` is `[{ item, rung }]`, `item` `<section>#<n>`, ordered by spec file path, then `n`; `a11y` is `[{ item, rung }]`, `rung` `none` or `example`, ordered by the project's `.keel/routes.json` path, route id, then criterion number; `libraries` is `{ [name]: { version, unsafe, hostElements } }` (k.library Ledger), `{}` when there is none. Keys and orders are UTF-16 code-unit orders; a `rung` is one of the six Ledger names. A file read holds this shape when it is a JSON object whose `version` is 1, `unsafe` and `hostElements` are integers, `hostElements` not negative, and whose `exports` is such an array, an entry with a field missing or of another type failing it; `negativeTypes`, `rungs`, `mutation`, `clauses`, `a11y` and `libraries` may be absent and, present, hold their form (a library's file is judged on the first four alone, k.library-pack Ledger file), and so may a package's counts and scores and a claim's `justified` be absent; other keys are ignored. `rungs` counts, per rung, the items with evidence on it; `mutation` holds each package's `{ score, scoreJustified, threshold, killed, survived, noCoverage, justified }`, the counts summed over its fresh claims, and the claims, a report on disk replacing its files' claims only, a claim with no file dropped, and a file the report holds with no scored mutant (all ignored) loses its claim. An `a11y` item of a project with no `reports/a11y.json` on disk keeps the rung the committed file holds; one whose report is present is computed again, and a committed item that is not the item of a page route of a project (k.a11y Claims) is dropped. The summary `counts` are `items`, `verified`, `unsafe` and `warnings`, then, each only above 0, `hostElements`, `negativeTypes`, one key per rung (`example` to `monitored`, as in `rungs`), `stale` and `keptNoReport` (the kept items). E1005 (k.compiler) skips an app's `.keel/ledger.json` and `monitored.json`. `--diff` compares with the committed ledger, reading reports as `--write` does."
// The summary `counts` clause is the last two sentences of that paragraph: `items`, `verified`, `unsafe`, `warnings`, then each only above 0 in the order the spec gives.
// Seed: 1337 (the property over subsets of three file-only conditions; every other case is one fixture). The real `keel` binary over temp projects (OS tmpdir); each case runs `keel ledger --write` once (rung cases `keel test` first).
// ASSUMPTIONS (spec silent, readings asserted):
//  - A case that holds a rung, `stale` or `keptNoReport` asserts that the key is present, that the keys after the four fixed ones are in the spec's order and each a name the spec lists, not that the other optional keys are absent: which items hold which rung is k.ledger Ledger's.
//  - A project with no optional condition has exactly the four fixed keys, in order.
import { readFileSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { PKG_REPORT, mutantsOf, mutationReport, withProject } from "./ledger-fixture-kinds.ts";
import { EXAMPLE, PROPERTY, SEEDED_100, SOURCE, exampleTest, propertyTest, source } from "./ledger-fixture.ts";
import { type CliRecord, keel, root, summaryOf, writeFiles } from "./test-sim-project.ts";

const SEED = 1337;
const COMMITTED = "tooling/ledger/ledger.json";
const BASE = ["items", "verified", "unsafe", "warnings"];
const CANON = [
  "hostElements",
  "negativeTypes",
  "example",
  "probabilistic",
  "exhaustive",
  "proven",
  "monitored",
  "stale",
  "keptNoReport",
];
const EXPECT = `@ts-${"expect-error"}`;

const keysOf = (r: CliRecord | undefined): string[] => {
  const c = r?.counts;
  return typeof c === "object" && c !== null && !Array.isArray(c) ? Object.keys(c) : [];
};
/** The keys of the summary `counts` of `run`, which must be one record. */
const countsKeys = (run: { records: CliRecord[] }): string[] => {
  expect(run.records.filter((r) => r.kind === "summary").length).toBe(1);
  return keysOf(summaryOf({ status: 0, records: run.records, stdout: "" }));
};
/** `keys` begins with the four fixed keys and the rest are names the spec lists, in its order, none twice. */
function expectOrder(keys: string[]): void {
  expect(keys.slice(0, 4)).toEqual(BASE);
  const rest = keys.slice(4);
  expect(
    rest.every((k) => CANON.includes(k)),
    JSON.stringify(keys),
  ).toBe(true);
  expect(
    rest.map((k) => CANON.indexOf(k)),
    JSON.stringify(keys),
  ).toEqual([...rest.map((k) => CANON.indexOf(k))].sort((a, b) => a - b));
  expect(new Set(rest).size).toBe(rest.length);
}

const HOST_HEAD =
  "import { s } from '@keel/schema'\nimport { Host } from '@keel/ui'\nconst In = s.object({ n: s.number() })\n";
const HOST_FILE = {
  "modules/app/D.ts": `${HOST_HEAD}export const d = () => Host({ id: "d.one", role: "img", label: "L", input: In, value: { n: 1 }, code: () => import('./chart.ts').then((m) => m.chart) })\n`,
  "modules/app/chart.ts": "export const chart = undefined\n",
};
const NEGATIVE_FILE = {
  "packages/p/test/a.test-d.ts": `// ${EXPECT} no string\nexport const a0: string = 0;\n`,
};
const MONITORED_FILES = {
  "packages/app/src/editor.ts": "export const editorChart = { id: 'todos.editor' };\n",
  ".keel/monitored.json": JSON.stringify({
    v: 1,
    origin: "https://app.example",
    from: 0,
    to: 60000,
    tx: { "todos.editor.save": 3 },
  }),
};
const BARE = { [SOURCE]: source };

/** `keel ledger --write` over `files` in a temp project linking `@keel/store` and `@keel/ui`; the summary's `counts` keys. */
function writtenKeys(
  prefix: string,
  files: Readonly<Record<string, string>>,
  before?: (dir: string) => void,
): string[] {
  return withProject(prefix, files, (dir) => {
    symlinkSync(join(root, "packages", "ui"), join(dir, "node_modules", "@keel", "ui"));
    before?.(dir);
    const run = keel(dir, ["ledger", "--write", COMMITTED]);
    expect(run.status, JSON.stringify(run.records).slice(0, 400)).toBe(0);
    return countsKeys(run);
  });
}

describe("k.ledger File: the summary `counts`", () => {
  it("are `items`, `verified`, `unsafe` and `warnings`, in that order, with none of the optional ones", () => {
    expect(writtenKeys("counts-bare", BARE)).toEqual(BASE);
  }, 60_000);

  it("then `hostElements` when above 0", () => {
    const keys = writtenKeys("counts-host", { ...BARE, ...HOST_FILE });
    expect(keys.slice(0, 5)).toEqual([...BASE, "hostElements"]);
    expectOrder(keys);
  }, 60_000);

  it("then `negativeTypes` when above 0", () => {
    const keys = writtenKeys("counts-negative", { ...BARE, ...NEGATIVE_FILE });
    expect(keys.slice(0, 5)).toEqual([...BASE, "negativeTypes"]);
    expectOrder(keys);
  }, 60_000);

  it("then `monitored`, a rung key, when an item holds it", () => {
    const keys = writtenKeys("counts-monitored", MONITORED_FILES);
    expect(keys).toContain("monitored");
    expectOrder(keys);
  }, 60_000);

  it("then `example`, a rung key, when an item holds it", () => {
    const keys = withProject("counts-example", { [SOURCE]: source, [EXAMPLE]: exampleTest }, (dir) => {
      expect(keel(dir, ["test"]).status).toBe(0);
      return countsKeys(keel(dir, ["ledger", "--write", COMMITTED]));
    });
    expect(keys).toContain("example");
    expectOrder(keys);
  }, 120_000);

  it("then `probabilistic`, a rung key, when an item holds it", () => {
    const keys = withProject(
      "counts-probabilistic",
      { [SOURCE]: source, [EXAMPLE]: exampleTest, [PROPERTY]: propertyTest(SEEDED_100) },
      (dir) => {
        expect(keel(dir, ["test"]).status).toBe(0);
        return countsKeys(keel(dir, ["ledger", "--write", COMMITTED]));
      },
    );
    expect(keys).toContain("probabilistic");
    expectOrder(keys);
  }, 120_000);

  it("then `exhaustive` and `proven`, rung keys, when items hold them", () => {
    const store = (name: string): string => `import { s } from "@keel/schema";
import { store, transaction } from "@keel/store";

const State = s.object({ on: s.boolean() });
export const ${name} = store(State, { on: false }, { id: "m.${name}" });
export const ${name}Set = transaction(${name}, "m.${name}Set", State, (_state, payload) => ({ on: payload.on }));
`;
    const explore = (name: string, call: string): string => `import { explore } from "@keel/testing";
import { expect, it } from "vitest";
import { ${name}Set } from "../src/${name}.ts";

it("explores ${name}", () => {
  const result = ${call};
  expect(result.states.length).toBeGreaterThan(0);
});
`;
    const keys = withProject(
      "counts-explore",
      {
        "packages/m/src/open.ts": store("open"),
        "packages/m/src/closed.ts": store("closed"),
        "packages/m/test/open.test.ts": explore("open", "explore([openSet], { depth: 2 })"),
        "packages/m/test/closed.test.ts": explore("closed", "explore([closedSet])"),
      },
      (dir) => {
        return countsKeys(keel(dir, ["ledger", "--write", COMMITTED]));
      },
    );
    expect(keys).toContain("exhaustive");
    expect(keys).toContain("proven");
    expectOrder(keys);
  }, 120_000);

  it("then `stale` when above 0", () => {
    const report = mutationReport(
      { "src/clamp.ts": { source, statuses: mutantsOf(3, 1) } },
      { high: 90, low: 80, break: 40 },
    );
    const keys = withProject("counts-stale", { [SOURCE]: source, [PKG_REPORT]: report }, (dir) => {
      expect(keel(dir, ["ledger", "--write", COMMITTED]).status).toBe(0);
      writeFiles(dir, { [SOURCE]: `${source}// edited after the mutation run\n` });
      return countsKeys(keel(dir, ["ledger", "--write", COMMITTED]));
    });
    expect(keys).toContain("stale");
    expectOrder(keys);
  }, 120_000);

  it("a committed a11y item with no `reports/a11y.json` is written at `none` and `counts` never holds `keptNoReport`", () => {
    const routes = `${JSON.stringify({ data: { r: { path: "/r" } }, hash: "fnv1a:00000000" })}\n`;
    const keys = withProject("counts-no-kept", { ".keel/routes.json": routes }, (dir) => {
      expect(keel(dir, ["ledger", "--write", COMMITTED]).status).toBe(0);
      const led: unknown = JSON.parse(readFileSync(join(dir, COMMITTED), "utf8"));
      const base = typeof led === "object" && led !== null ? led : {};
      writeFiles(dir, {
        [COMMITTED]: `${JSON.stringify({ ...base, a11y: [{ item: "a11y:.:r#1.4.3", rung: "example" }] }, null, 2)}\n`,
      });
      return countsKeys(keel(dir, ["ledger", "--write", COMMITTED]));
    });
    expect(keys).not.toContain("keptNoReport");
    expectOrder(keys);
  }, 120_000);

  it("property: any subset of `hostElements`, `negativeTypes` and `monitored` gives the four fixed keys and then exactly those, in the spec's order", () => {
    const conditions: Record<string, Record<string, string>> = {
      hostElements: HOST_FILE,
      negativeTypes: NEGATIVE_FILE,
      monitored: MONITORED_FILES,
    };
    fc.assert(
      fc.property(fc.subarray(Object.keys(conditions)), (chosen) => {
        const files = chosen.reduce<Record<string, string>>((acc, k) => ({ ...acc, ...conditions[k] }), { ...BARE });
        const keys = writtenKeys("counts-subset", files);
        expect(keys).toEqual([...BASE, ...CANON.filter((k) => chosen.includes(k))]);
      }),
      { seed: SEED, numRuns: 8 },
    );
  }, 300_000);
});
