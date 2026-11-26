// Spec: k.a11y, clause "Under `keel test` in a project with `.keel/a11y.json` whose `tokens.ts` gives page `r`'s text 4.4:1 against its background, a `renderRoute` of `r` given no `artifacts` fails with E1804 and its run's `rules` hold E1702 and E1804; given `artifacts: {}` it passes and its run's `rules` hold none of E1702, E1804 and E1820."
// Spec: k.a11y, clause "Under `keel test` in a project with no `tokens.ts`, a passing `renderRoute` of page `r` given no `artifacts` records a run whose `rules` hold neither E1804 nor E1820, and `keel ledger` gives `a11y:.:r#1.4.3` rung `none`."
// Spec: k.a11y, clause "Under `keel test` in a project whose `tokens.ts` exports no `tokens`, a `render` given no `artifacts` throws E1807; run by vitest without `KEEL_TEST`, a `renderRoute` given no `artifacts` of a page whose text is 4.4:1 against its background passes."
// Spec: k.a11y, clause "With two passing `renderRoute` tests of page `r` in a project with `tokens.ts`, one given `artifacts: {}` and one given no `artifacts`, `keel ledger` gives `a11y:.:r#1.4.3` rung `example`; with only the first, `none`."
// Seed: 1337 (no random property: the run-mix law is enumerated over every multiset of one or two tests, in one project; every other case is a fixed project).
// Cost: the cases that only read a built project share it: one `keel build`, `keel test` and `keel ledger` per project (a `beforeAll`), a route and a test per scenario; the E1807 cases share one project and rewrite `tokens.ts`.
// E1807 is thrown by the render and names `tokens.ts` (k.a11y Artifacts): the fixture test asserts both.
// The real `keel` binary over temp projects (OS tmpdir), as a11y-ledger-claims.test.ts. Assumed: route ids carry the module prefix (`m.r`; the clause's `r` is `m.r`),
// `keel build` writes `.keel/a11y.json`, a failing `renderRoute` still records its run in `reports/a11y.json` (`{ route, rules, violations: [{ rule, element }], test, passed }`),
// `#4.1.2` is earned by E1702 plus the axe rules tagged 4.1.2, all of which run when `.keel/a11y.json` is given.
// 4.4:1 is `#787878` on `#ffffff` (4.41:1); `#111111` is far above 4.5:1; `#8a8a8a` is below it.
// Under `keel test` the expected E1807 inputs (a `tokens.ts` that throws, exports no `tokens`, or fails `TokenSchema`) are not built first: `keel build` gives E1807 for them too (k.a11y Artifacts).
import { fixedTime } from "@keel/tooling/test-time";
import { realpathSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ENV,
  type SeenRun,
  buildAndTest,
  itemRecord,
  keelProject,
  moduleFiles,
  runsOf,
  testHead,
  tokensSource,
} from "./a11y-project-support.ts";
import { type Run, keel, plainVitest, removeProject, writeFiles } from "./test-sim-project.ts";

const created: string[] = [];
afterAll(() => {
  for (const d of created) removeProject(d);
});
const track = (dir: string): string => {
  created.push(dir);
  return dir;
};
const CRITERIA = ["1.3.2", "1.4.3", "2.4.3", "4.1.2"];
/** A passing test of route `m.<id>` whose `renderRoute` call takes `call` as its extra options. */
const renders = (call: string, id = "r", name = "renders the route r"): string => `
it("${name}", async () => {
  const h = await renderRoute("m.${id}", { routes, ctx: ctx()${call} });
  expect(h.find("m.${id}.msg").text).toBe("${id}");
  h.dispose();
});
`;
const refused = (name: string, call: string, code: string): string => `
it("${name}", async () => {
  await expect(renderRoute("m.r", { routes, ctx: ctx()${call} })).rejects.toMatchObject({ code: "${code}" });
});
`;
const rulesOf = (runs: readonly SeenRun[], test: string): string[] => {
  const found = runs.filter((r) => r.route === "m.r" && r.test.includes(test));
  expect(found).toHaveLength(1);
  return found[0]?.rules ?? [];
};

describe("k.a11y: the project's artifacts are the default under `keel test`", () => {
  let onDir = "";
  let noTokensDir = "";
  let noTokensLedger: Run;
  beforeAll(() => {
    onDir = track(
      keelProject("a11y-default-on", {
        ...moduleFiles(["r"], true),
        "tokens.ts": tokensSource("#787878"),
        "modules/m/test/r.test.ts": `${testHead(false)}${refused("default artifacts refuse the text", "", "E1804")}
it("opted out with an empty artifacts", async () => {
  const h = await renderRoute("m.r", { routes, ctx: ctx(), artifacts: {} });
  expect(h.find("m.r.msg").text).toBe("r");
  h.dispose();
});
`,
      }),
    );
    expect(buildAndTest(onDir).status).toBe(0);
    noTokensDir = track(
      keelProject("a11y-default-no-tokens", {
        ...moduleFiles(["r"], false),
        "modules/m/test/r.test.ts": `${testHead(false)}${renders("")}`,
      }),
    );
    expect(buildAndTest(noTokensDir).status).toBe(0);
    noTokensLedger = keel(noTokensDir, ["ledger"]);
  }, fixedTime(240_000));

  it("with `.keel/a11y.json` and a `tokens.ts` whose text is 4.4:1, a `renderRoute` given no `artifacts` fails with E1804 and its run's `rules` hold E1702 and E1804; given `artifacts: {}` it passes and its run's `rules` hold none of E1702, E1804 and E1820", () => {
    const runs = runsOf(onDir);
    const given = rulesOf(runs, "default artifacts refuse");
    expect(given).toContain("E1702");
    expect(given).toContain("E1804");
    const empty = rulesOf(runs, "opted out");
    for (const code of ["E1702", "E1804", "E1820"]) expect(empty).not.toContain(code);
  });

  it("in a project with no `tokens.ts`, a passing `renderRoute` given no `artifacts` records a run whose `rules` hold neither E1804 nor E1820, and `a11y:.:r#1.4.3` is rung `none`", () => {
    const rules = rulesOf(runsOf(noTokensDir), "renders the route r");
    expect(rules).not.toContain("E1804");
    expect(rules).not.toContain("E1820");
    for (const criterion of ["1.4.3", "1.3.2", "2.4.3"]) {
      expect(itemRecord(noTokensLedger, `a11y:.:m.r#${criterion}`)).toMatchObject({ rung: "none" });
    }
  });

  describe("a `tokens.ts` that does not give `tokens`", () => {
    const broken = [
      ["exports no `tokens`", "export const other = 1;\n"],
      ["throws", 'throw new Error("tokens.ts is broken");\n'],
      ["fails `TokenSchema`", "export const tokens = { color: 5 };\n"],
    ] as const;
    let dir = "";
    beforeAll(() => {
      dir = track(
        keelProject("a11y-default-e1807", {
          "tokens.ts": broken[0][1],
          "modules/m/test/r.test.ts": `${ENV}
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { render } from "@keel/testing";
import { Text } from "@keel/ui";
import { expect, it } from "vitest";
const view = Object.assign(() => Text({ id: "t", children: "x" }), { Props: s.object({}) });
it("throws E1807 naming tokens.ts", async () => {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  await expect(Promise.resolve().then(() => render(view, { props: {}, ctx }))).rejects.toMatchObject({
    code: "E1807",
    message: expect.stringContaining("tokens.ts"),
  });
});
`,
        }),
      );
    });
    for (const [what, source] of broken) {
      it(
        `a \`render\` given no \`artifacts\` throws E1807 naming \`tokens.ts\` when \`tokens.ts\` ${what}`,
        () => {
          writeFiles(dir, { "tokens.ts": source });
          expect(keel(dir, ["test"]).status).toBe(0);
        },
        fixedTime(120_000),
      );
    }
  });

  it(
    "run by vitest without `KEEL_TEST`, a `renderRoute` given no `artifacts` of a page whose text is 4.4:1 passes; under `keel test` the same test is refused with E1804",
    () => {
      const dir = track(
        keelProject("a11y-default-plain", {
          ...moduleFiles(["r"], true),
          "tokens.ts": tokensSource("#787878"),
          // plain vitest takes the `keel()` plugin from a config; `keel test` needs none
          "vitest.config.ts": `import keel from "@keel/compiler/vite"\nimport { defineConfig } from "vitest/config"\nexport default defineConfig({ plugins: [keel()] })\n`,
          "modules/m/test/r.test.ts": `${testHead(false)}${renders("")}`,
        }),
      );
      expect(plainVitest(realpathSync(dir)).status).toBe(0);
      // non-vacuity: the defaults are there for `keel test`, which fails the same test
      expect(buildAndTest(dir).status).not.toBe(0);
    },
    fixedTime(240_000),
  );
});

describe("k.a11y: a criterion counts when every mapped rule ran in some passing run and none was violated", () => {
  // one project, one route per scenario, built, tested and read once
  const kinds = ["empty", "default", "explicit"] as const;
  const call = { empty: ", artifacts: {}", default: "", explicit: ", artifacts: { tokens }" };
  const mixes: (typeof kinds)[number][][] = [];
  for (const a of kinds) mixes.push([a]);
  for (const a of kinds) for (const b of kinds) if (kinds.indexOf(a) <= kinds.indexOf(b)) mixes.push([a, b]);
  const mixIds = mixes.map((_, i) => `r${i}`);
  const mixTests = mixes
    .map((mix, i) => mix.map((kind, j) => renders(call[kind], `r${i}`, `mix ${i} test ${j} ${kind}`)).join(""))
    .join("");
  // a test that expects the E1804 refusal passes with a violation recorded; its tokens are below 4.5:1
  const violated = `
it("refuses text below 4.5:1", async () => {
  const bad = defineTokens({ color: { fg: "#8a8a8a", bg: "#ffffff" } });
  await expect(renderRoute("m.vm", { routes, ctx: ctx(), artifacts: { tokens: bad } })).rejects.toMatchObject({ code: "E1804" });
});
`;
  const tests = [
    renders(", artifacts: {}", "o", "opted out of the artifacts"),
    renders("", "d", "given the default artifacts"),
    renders(", artifacts: {}", "u", "union empty"),
    renders("", "u", "union default"),
    renders(", artifacts: {}", "uf", "first only"),
    renders("", "vc", "clean default"),
    renders("", "vm", "mixed default"),
    renders("", "vm", "mixed second"),
    violated,
    mixTests,
  ].join("");
  let ledger: Run;
  beforeAll(() => {
    const dir = track(
      keelProject("a11y-default-runs", {
        ...moduleFiles(["o", "d", "u", "uf", "vc", "vm", ...mixIds], true),
        "tokens.ts": tokensSource("#111111"),
        "modules/m/test/r.test.ts": `${testHead(true)}import { defineTokens } from "@keel/ui";\n${tests}`,
      }),
    );
    expect(buildAndTest(dir).status).toBe(0);
    ledger = keel(dir, ["ledger"]);
  }, fixedTime(300_000));

  it("a test given `artifacts: {}` earns none of 1.3.2, 1.4.3, 2.4.3 and 4.1.2, which the same test given no `artifacts` earns", () => {
    for (const criterion of CRITERIA) {
      expect(itemRecord(ledger, `a11y:.:m.o#${criterion}`)).toMatchObject({ rung: "none" });
      expect(itemRecord(ledger, `a11y:.:m.d#${criterion}`)).toMatchObject({ rung: "example" });
    }
  });

  it("two passing `renderRoute` tests of page `r`, one given `artifacts: {}` and one given none: `a11y:.:r#1.4.3` is rung `example`; with only the first, `none`", () => {
    expect(itemRecord(ledger, "a11y:.:m.u#1.4.3")).toMatchObject({ rung: "example" });
    expect(itemRecord(ledger, "a11y:.:m.uf#1.4.3")).toMatchObject({ rung: "none" });
  });

  it("a rule violated in any passing run makes the criterion `none`, however many other passing runs ran it clean", () => {
    expect(itemRecord(ledger, "a11y:.:m.vc#1.4.3")).toMatchObject({ rung: "example" });
    expect(itemRecord(ledger, "a11y:.:m.vm#1.4.3")).toMatchObject({ rung: "none" });
  });

  it("over every mix of one or two passing tests of a route, given no, empty or explicit artifacts, 1.4.3 is `example` exactly when some run ran E1804", () => {
    mixes.forEach((mix, i) => {
      const earned = mix.some((kind) => kind !== "empty");
      expect(itemRecord(ledger, `a11y:.:m.r${i}#1.4.3`), mix.join("+")).toMatchObject({
        rung: earned ? "example" : "none",
      });
    });
  });
});
