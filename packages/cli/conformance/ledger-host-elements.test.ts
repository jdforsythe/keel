// Spec: k.host-element, clause "`keel ledger --write` of a fixture with two `Host` elements writes `hostElements: 2` beside `unsafe`; a third makes `--diff` report E1706."
// k.host-element, Ledger "`keel ledger --write` writes `hostElements`, an integer at the ledger file's top level after `unsafe` (k.ledger): the count of `<Host>` elements and `Host(...)` calls of `@keel/ui`'s `Host` in `src` and `unsafe` directories of `packages/*`, every file of `apps/*` and the root `modules/**` of an app, plus each library's `hostElements` (k.library). With `--scope` it counts the apps in scope, written and not compared. E1706 also reports a count higher than the committed one, in a run without `--scope`."
// Seed: 1337 (no generated inputs besides the element count, enumerated).
// The real `keel` binary over a temp project; the ledger file is read as JSON and `hostElements` is looked up at its top level, after `unsafe`. The keel-library.json half is built later and is not tested here.
// Ambiguous: the value form of `--scope` is not written in k.host-element; the scope test passes the app folder as a path prefix.
import { readFileSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { keel, makeProject, removeProject, root, writeFiles } from "./test-sim-project.ts";

const COMMITTED = ".keel/ledger.json";
const HEAD =
  "import { s } from '@keel/schema'\nimport { Host } from '@keel/ui'\nconst In = s.object({ n: s.number() })\n";
const element = (id: string): string =>
  `<Host id="${id}" role="img" label="L" input={In} value={{ n: 1 }} code={() => import('./chart.ts').then((m) => m.chart)} />`;
const chartCode = "export const chart = undefined\n";
const component = (name: string, ids: readonly string[]): string =>
  `${HEAD}export default function ${name}() { return <div>${ids.map(element).join("")}</div> }\n`;

let dir = "";
beforeAll(() => {
  dir = makeProject("host-ledger", {
    "modules/app/A.tsx": component("A", ["a.one"]),
    "modules/app/B.tsx": component("B", ["b.one"]),
    "modules/app/chart.ts": chartCode,
  });
  symlinkSync(join(root, "packages", "ui"), join(dir, "node_modules", "@keel", "ui"));
}, 60_000);
afterAll(() => {
  removeProject(dir);
});

const written = (): unknown => JSON.parse(readFileSync(join(dir, COMMITTED), "utf8"));
const hostElements = (v: unknown): unknown =>
  typeof v === "object" && v !== null && "hostElements" in v ? v.hostElements : undefined;

describe("k.host-element: the ledger counts host elements", () => {
  it("`keel ledger --write` of a fixture with two `Host` elements writes `hostElements: 2`", () => {
    const run = keel(dir, ["ledger", "--write", COMMITTED]);
    expect(run.status).toBe(0);
    expect(hostElements(written())).toBe(2);
  }, 60_000);

  it("`hostElements` is an integer at the top level, right after `unsafe`", () => {
    const v = written();
    expect(typeof v).toBe("object");
    if (typeof v !== "object" || v === null) return;
    const keys = Object.keys(v);
    expect(Number.isInteger(hostElements(v))).toBe(true);
    expect(keys.indexOf("hostElements")).toBe(keys.indexOf("unsafe") + 1);
    expect(keys.indexOf("unsafe")).toBeGreaterThanOrEqual(0);
  });

  it("a `Host(...)` call counts as an element, as `<Host>` does", () => {
    writeFiles(dir, {
      "modules/app/D.ts": `${HEAD}export const d = () => Host({ id: "d.one", role: "img", label: "L", input: In, value: { n: 1 }, code: () => import('./chart.ts').then((m) => m.chart) })\n`,
    });
    const run = keel(dir, ["ledger", "--write", "modules-call.json"]);
    expect(run.status).toBe(0);
    expect(hostElements(JSON.parse(readFileSync(join(dir, "modules-call.json"), "utf8")))).toBe(3);
    writeFiles(dir, { "modules/app/D.ts": "export const d = 1\n" });
  }, 60_000);

  it("with `--scope` the count covers the apps in scope", () => {
    const run = keel(dir, ["ledger", "--write", "scoped.json", "--scope", "modules/app/"]);
    expect(run.status).toBe(0);
    expect(hostElements(JSON.parse(readFileSync(join(dir, "scoped.json"), "utf8")))).toBe(2);
    expect(run.records.filter((r) => r.kind === "diag" && r.code === "E1706")).toEqual([]);
  }, 60_000);

  it("`--diff` against that ledger is ok while the count is unchanged", () => {
    const diff = keel(dir, ["ledger", "--diff"]);
    expect(diff.status).toBe(0);
    expect(diff.records.filter((r) => r.kind === "diag" && r.code === "E1706")).toEqual([]);
  }, 60_000);

  it("a third `Host` makes `--diff` report E1706, exit 1", () => {
    writeFiles(dir, { "modules/app/C.tsx": component("C", ["c.one"]) });
    const diff = keel(dir, ["ledger", "--diff"]);
    expect(diff.status).toBe(1);
    expect(diff.records.filter((r) => r.kind === "diag" && r.code === "E1706")).toHaveLength(1);
  }, 60_000);

  it("a lower count than the committed one is not reported", () => {
    writeFiles(dir, { "modules/app/C.tsx": component("C", []), "modules/app/B.tsx": component("B", []) });
    const diff = keel(dir, ["ledger", "--diff"]);
    expect(diff.records.filter((r) => r.kind === "diag" && r.code === "E1706")).toEqual([]);
  }, 60_000);
});
