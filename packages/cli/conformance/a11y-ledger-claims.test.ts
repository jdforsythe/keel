// Spec: k.a11y, Conformance "After `keel test` in a project with page routes `r` and `r2` and one passing `renderRoute` test of `r`, `keel ledger` run in the project gives `a11y:.:r#1.4.3` rung `example` and `a11y:.:r2#1.4.3` rung `none`; a violation of a rule mapped to 1.4.3 on `r` makes it `none`."
// Spec: k.a11y, Conformance "With projects `apps/a` and `apps/b` each holding page route `m.r`, and `keel test` run in `apps/a` with one passing `renderRoute` test of `m.r` and in `apps/b` with none, `keel ledger` run in their parent directory over no committed ledger gives `a11y:apps/a:m.r#1.4.3` rung `example` and `a11y:apps/b:m.r#1.4.3` rung `none`."
// Seed: 1337 (the key-injectivity property below; every other case is a fixed project, one binary run per step).
// The real `keel` binary over temp projects (OS tmpdir). Assumed: route ids carry the module prefix (`m.r`, `m.r2`; the clause's `r` is `m.r`),
// `keel build` (node-only topology) writes `.keel/routes.json`, `keel ledger` finds every project under its directory by its `.keel/routes.json`,
// and tokens reach `renderRoute` as `artifacts: { tokens }`.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  COMMITTED,
  ENV,
  a11yItems,
  buildAndTest,
  itemRecord,
  keelProject,
  moduleFiles,
  testHead,
  tokensSource,
} from "./a11y-project-support.ts";
import { collect } from "./ledger-fixture-kinds.ts";
import { type Run, keel, removeProject, writeFiles } from "./test-sim-project.ts";

const ITEM_R = "a11y:.:m.r#1.4.3";
const ITEM_R2 = "a11y:.:m.r2#1.4.3";

const PASSING = `${testHead(true)}
it("renders the route r", async () => {
  const h = await renderRoute("m.r", { routes, ctx: ctx(), artifacts: { tokens } });
  expect(h.find("m.r.msg").text).toBe("r");
  h.dispose();
});
`;
// the route's text is below 4.5:1 and the test expects the E1804 refusal, so it passes with a recorded violation
const VIOLATING = `${testHead(true)}
it("refuses the route r", async () => {
  await expect(renderRoute("m.r", { routes, ctx: ctx(), artifacts: { tokens } })).rejects.toMatchObject({ code: "E1804" });
});
`;
const NO_RENDER = `${ENV}
import { expect, it } from "vitest";
it("renders nothing", () => {
  expect(1).toBe(1);
});
`;

const created: string[] = [];
const track = (dir: string): string => {
  created.push(dir);
  return dir;
};
const single = (prefix: string, fg: string, test: string): string =>
  track(
    keelProject(prefix, {
      ...moduleFiles(["r", "r2"], true),
      "tokens.ts": tokensSource(fg),
      "modules/m/test/r.test.ts": test,
    }),
  );
const ledgerAfterTest = (dir: string): Run => {
  expect(buildAndTest(dir).status).toBe(0);
  return keel(dir, ["ledger"]);
};

/** `files` of one project, under `at/`. */
const under = (at: string, files: Readonly<Record<string, string>>): Record<string, string> =>
  Object.fromEntries(Object.entries(files).map(([path, source]) => [`${at}/${path}`, source]));
const projectFiles = (fg: string, test: string): Record<string, string> => ({
  ...moduleFiles(["r"], true),
  "tokens.ts": tokensSource(fg),
  "modules/m/test/r.test.ts": test,
});
const routesJson = (ids: readonly string[]): string =>
  `${JSON.stringify({ data: Object.fromEntries(ids.map((id) => [id, { path: `/${id}` }])), hash: "fnv1a:00000000" })}\n`;

let passing: Run;
let violating: Run;
let violatingDir = "";
let parent: Run;
beforeAll(() => {
  passing = ledgerAfterTest(single("a11y-ledger-pass", "#111111", PASSING));
  violatingDir = single("a11y-ledger-bad", "#8a8a8a", VIOLATING);
  violating = ledgerAfterTest(violatingDir);
  const parentDir = track(
    keelProject("a11y-ledger-two", {
      ...under("apps/a", projectFiles("#111111", PASSING)),
      ...under("apps/b", projectFiles("#111111", NO_RENDER)),
    }),
  );
  expect(buildAndTest(join(parentDir, "apps", "a")).status).toBe(0);
  expect(buildAndTest(join(parentDir, "apps", "b")).status).toBe(0);
  parent = keel(parentDir, ["ledger"]);
}, 360_000);
afterAll(() => {
  for (const d of created) removeProject(d);
});

describe("k.a11y: ledger claims from reports/a11y.json", () => {
  it("After `keel test` with one passing `renderRoute` test of route `r`, `keel ledger` gives `a11y:.:r#1.4.3` rung `example`", () => {
    expect(itemRecord(passing, ITEM_R)).toMatchObject({ kind: "ledger", item: ITEM_R, rung: "example" });
  });

  it("`a11y:.:r2#1.4.3` is rung `none` for the untested page route `r2`", () => {
    expect(itemRecord(passing, ITEM_R2)).toMatchObject({ kind: "ledger", item: ITEM_R2, rung: "none" });
  });

  it("a violation of a rule mapped to 1.4.3 on `r` makes it `none`", () => {
    expect(itemRecord(violating, ITEM_R)).toMatchObject({ item: ITEM_R, rung: "none" });
  });

  it("no item is in the old form `a11y:<routeId>#<criterion>`", () => {
    for (const run of [passing, violating]) {
      const items = a11yItems(run);
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) expect(item).toMatch(/^a11y:[^:#]+:[^:#]+#\d+\.\d+\.\d+$/);
    }
  });

  it("`keel test` writes every render check to `reports/a11y.json` as `A11yRun[]` with route, rules run and violations", () => {
    const text = readFileSync(join(violatingDir, "reports", "a11y.json"), "utf8");
    const runs: unknown = JSON.parse(text);
    expect(Array.isArray(runs)).toBe(true);
    expect(text).toContain("m.r");
    expect(text).toContain("E1804");
  });

  it("every claim is `{ kind: 'ledger', item, rung, evidence }`", () => {
    const rec = itemRecord(passing, ITEM_R);
    expect(Object.keys(rec ?? {}).sort()).toEqual(["evidence", "item", "kind", "rung"]);
  });
});

describe("k.a11y: the project is in the item", () => {
  it("with projects `apps/a` and `apps/b` each holding page route `m.r`, `keel ledger` in their parent gives `a11y:apps/a:m.r#1.4.3` rung `example` and `a11y:apps/b:m.r#1.4.3` rung `none`", () => {
    expect(itemRecord(parent, "a11y:apps/a:m.r#1.4.3")).toMatchObject({ rung: "example" });
    expect(itemRecord(parent, "a11y:apps/b:m.r#1.4.3")).toMatchObject({ rung: "none" });
  });

  it("two projects sharing a route id give distinct items for every criterion and neither takes the other's rung", () => {
    const items = a11yItems(parent);
    expect(new Set(items).size).toBe(items.length);
    const criteria = (project: string): string[] =>
      items.filter((i) => i.startsWith(`a11y:${project}:m.r#`)).map((i) => i.slice(i.indexOf("#")));
    expect(criteria("apps/a").length).toBeGreaterThan(0);
    expect(criteria("apps/a")).toEqual(criteria("apps/b"));
    // `apps/b` ran no render: every one of its items is `none`, whatever `apps/a` earned
    for (const criterion of criteria("apps/b")) {
      expect(itemRecord(parent, `a11y:apps/b:m.r${criterion}`)).toMatchObject({ rung: "none" });
    }
  });

  it("a project with no `reports/a11y.json` keeps the rung its own committed item holds, not the rung of another project's item of the same route id", () => {
    const dir = track(
      keelProject("a11y-ledger-kept-two", {
        "apps/a/.keel/routes.json": routesJson(["m.r"]),
        "apps/b/.keel/routes.json": routesJson(["m.r"]),
      }),
    );
    expect(keel(dir, ["ledger", "--write", COMMITTED]).status).toBe(0);
    const led: unknown = JSON.parse(readFileSync(join(dir, COMMITTED), "utf8"));
    if (typeof led !== "object" || led === null) throw new Error("ledger is not an object");
    const a11y = [
      { item: "a11y:apps/a:m.r#1.4.3", rung: "example" },
      { item: "a11y:apps/b:m.r#1.4.3", rung: "none" },
    ];
    writeFiles(dir, { [COMMITTED]: `${JSON.stringify({ ...led, a11y }, null, 2)}\n` });
    expect(keel(dir, ["ledger", "--write", COMMITTED]).status).toBe(0);
    const written = collect(JSON.parse(readFileSync(join(dir, COMMITTED), "utf8")), ["item", "rung"]);
    expect(written.find((x) => x.item === "a11y:apps/a:m.r#1.4.3")?.rung).toBe("example");
    expect(written.find((x) => x.item === "a11y:apps/b:m.r#1.4.3")?.rung).toBe("none");
  }, 60_000);

  it("the key is injective: two different (project, route id) pairs never give one key (property, seed 1337)", () => {
    const name = fc.stringMatching(/^[a-z][a-z0-9-]{0,5}$/);
    const projectDir = fc.tuple(fc.constantFrom("apps", "examples"), name).map(([top, leaf]) => `${top}/${leaf}`);
    const pool = ["m.r", "m.s", "x.y", "m.r2"];
    const tree = fc.uniqueArray(
      fc.tuple(projectDir, fc.uniqueArray(fc.constantFrom(...pool), { minLength: 1, maxLength: 3 })),
      { selector: ([dir]) => dir, minLength: 1, maxLength: 3 },
    );
    fc.assert(
      fc.property(tree, (projects) => {
        const files: Record<string, string> = {};
        for (const [dir, ids] of projects) files[`${dir}/.keel/routes.json`] = routesJson(ids);
        const dir = keelProject("a11y-ledger-inj", files);
        try {
          const items = a11yItems(keel(dir, ["ledger"]));
          const wanted = projects.flatMap(([project, ids]) => ids.map((id) => `a11y:${project}:${id}#1.4.3`));
          // every pair has a key of its own
          expect(new Set(wanted).size).toBe(wanted.length);
          // no emitted key is emitted twice
          expect(new Set(items).size).toBe(items.length);
          // the keys of one criterion are exactly the (project, page route) pairs
          expect(items.filter((i) => i.endsWith("#1.4.3")).sort()).toEqual([...wanted].sort());
        } finally {
          removeProject(dir);
        }
      }),
      { seed: 1337, numRuns: 25 },
    );
  }, 300_000);
});
