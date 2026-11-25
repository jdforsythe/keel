// Spec: k.a11y, Conformance "Under `keel test` in a project with `.keel/a11y.json` whose `tokens.ts` gives page `r`'s text 4.4:1 against its background, a `renderRoute` of `r` given no `artifacts` fails with E1804 and its run's `rules` hold E1702 and E1804; given `artifacts: {}` it passes and its run's `rules` hold none of E1702, E1804 and E1820."
// Spec: k.a11y, Conformance "Under `keel test` in a project with no `tokens.ts`, a passing `renderRoute` of page `r` given no `artifacts` records a run whose `rules` hold neither E1804 nor E1820, and `keel ledger` gives `a11y:.:r#1.4.3` rung `none`."
// Spec: k.a11y, Conformance "Under `keel test` in a project whose `tokens.ts` exports no `tokens`, a `render` given no `artifacts` throws E1807; run by vitest without `KEEL_TEST`, a `renderRoute` given no `artifacts` of a page whose text is 4.4:1 against its background passes."
// Spec: k.a11y, Conformance "With two passing `renderRoute` tests of page `r` in a project with `tokens.ts`, one given `artifacts: {}` and one given no `artifacts`, `keel ledger` gives `a11y:.:r#1.4.3` rung `example`; with only the first, `none`."
// Seed: 1337 (no random property: the run-mix law is enumerated over every multiset of one or two tests, in one project; every other case is a fixed project).
// The real `keel` binary over temp projects (OS tmpdir), as a11y-ledger-claims.test.ts. Assumed: route ids carry the module prefix (`m.r`; the clause's `r` is `m.r`),
// `keel build` writes `.keel/a11y.json`, a failing `renderRoute` still records its run in `reports/a11y.json` (`{ route, rules, violations: [{ rule, element }], test, passed }`),
// `#4.1.2` is earned by E1702 plus the axe rules tagged 4.1.2, all of which run when `.keel/a11y.json` is given.
// 4.4:1 is `#787878` on `#ffffff` (4.41:1); `#111111` is far above 4.5:1; `#8a8a8a` is below it.
// Under `keel test` the expected E1807 inputs (a `tokens.ts` that throws, exports no `tokens`, or fails `TokenSchema`) are not built first: `keel build` gives E1807 for them too (k.a11y Artifacts).
import { realpathSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
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
import { keel, plainVitest, removeProject } from "./test-sim-project.ts";

const created: string[] = [];
afterAll(() => {
  for (const d of created) removeProject(d);
});
const track = (dir: string): string => {
  created.push(dir);
  return dir;
};
const CRITERIA = ["1.3.2", "1.4.3", "2.4.3", "4.1.2"];
const renders = (call: string): string => `
it("renders the route r", async () => {
  const h = await renderRoute("m.r", { routes, ctx: ctx()${call} });
  expect(h.find("m.r.msg").text).toBe("r");
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
  it("with `.keel/a11y.json` and a `tokens.ts` whose text is 4.4:1, a `renderRoute` given no `artifacts` fails with E1804 and its run's `rules` hold E1702 and E1804; given `artifacts: {}` it passes and its run's `rules` hold none of E1702, E1804 and E1820", () => {
    const dir = track(
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
    expect(buildAndTest(dir).status).toBe(0);
    const runs = runsOf(dir);
    const given = rulesOf(runs, "default artifacts refuse");
    expect(given).toContain("E1702");
    expect(given).toContain("E1804");
    const empty = rulesOf(runs, "opted out");
    for (const code of ["E1702", "E1804", "E1820"]) expect(empty).not.toContain(code);
  }, 180_000);

  it("a test given `artifacts: {}` earns none of 1.3.2, 1.4.3, 2.4.3 and 4.1.2, which the same test given no `artifacts` earns", () => {
    const earned = (call: string, prefix: string) => {
      const dir = track(
        keelProject(prefix, {
          ...moduleFiles(["r"], true),
          "tokens.ts": tokensSource("#111111"),
          "modules/m/test/r.test.ts": `${testHead(false)}${renders(call)}`,
        }),
      );
      expect(buildAndTest(dir).status).toBe(0);
      return keel(dir, ["ledger"]);
    };
    const opted = earned(", artifacts: {}", "a11y-default-optout");
    const defaulted = earned("", "a11y-default-control");
    for (const criterion of CRITERIA) {
      expect(itemRecord(opted, `a11y:.:m.r#${criterion}`)).toMatchObject({ rung: "none" });
      expect(itemRecord(defaulted, `a11y:.:m.r#${criterion}`)).toMatchObject({ rung: "example" });
    }
  }, 240_000);

  it("in a project with no `tokens.ts`, a passing `renderRoute` given no `artifacts` records a run whose `rules` hold neither E1804 nor E1820, and `a11y:.:r#1.4.3` is rung `none`", () => {
    const dir = track(
      keelProject("a11y-default-no-tokens", {
        ...moduleFiles(["r"], false),
        "modules/m/test/r.test.ts": `${testHead(false)}${renders("")}`,
      }),
    );
    expect(buildAndTest(dir).status).toBe(0);
    const rules = rulesOf(runsOf(dir), "renders the route r");
    expect(rules).not.toContain("E1804");
    expect(rules).not.toContain("E1820");
    const ledger = keel(dir, ["ledger"]);
    for (const criterion of ["1.4.3", "1.3.2", "2.4.3"]) {
      expect(itemRecord(ledger, `a11y:.:m.r#${criterion}`)).toMatchObject({ rung: "none" });
    }
  }, 180_000);

  const broken = [
    ["exports no `tokens`", "export const other = 1;\n"],
    ["throws", 'throw new Error("tokens.ts is broken");\n'],
    ["fails `TokenSchema`", "export const tokens = { color: 5 };\n"],
  ] as const;
  for (const [what, source] of broken) {
    it(`a \`render\` given no \`artifacts\` throws E1807 when \`tokens.ts\` ${what}`, () => {
      const dir = track(
        keelProject("a11y-default-e1807", {
          "tokens.ts": source,
          "modules/m/test/r.test.ts": `${ENV}
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { render } from "@keel/testing";
import { Text } from "@keel/ui";
import { expect, it } from "vitest";
const view = Object.assign(() => Text({ id: "t", children: "x" }), { Props: s.object({}) });
it("throws E1807", async () => {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  await expect(Promise.resolve().then(() => render(view, { props: {}, ctx }))).rejects.toMatchObject({ code: "E1807" });
});
`,
        }),
      );
      expect(keel(dir, ["test"]).status).toBe(0);
    }, 120_000);
  }

  it("run by vitest without `KEEL_TEST`, a `renderRoute` given no `artifacts` of a page whose text is 4.4:1 passes; under `keel test` the same test is refused with E1804", () => {
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
  }, 240_000);
});

describe("k.a11y: a criterion counts when every mapped rule ran in some passing run and none was violated", () => {
  const two = (prefix: string, tests: string): ReturnType<typeof keel> => {
    const dir = track(
      keelProject(prefix, {
        ...moduleFiles(["r"], true),
        "tokens.ts": tokensSource("#111111"),
        "modules/m/test/r.test.ts": `${testHead(false)}${tests}`,
      }),
    );
    expect(buildAndTest(dir).status).toBe(0);
    return keel(dir, ["ledger"]);
  };
  const emptyTest = `
it("renders with an empty artifacts", async () => {
  const h = await renderRoute("m.r", { routes, ctx: ctx(), artifacts: {} });
  h.dispose();
});
`;
  const defaultTest = `
it("renders with the default artifacts", async () => {
  const h = await renderRoute("m.r", { routes, ctx: ctx() });
  h.dispose();
});
`;

  it("two passing `renderRoute` tests of page `r`, one given `artifacts: {}` and one given none: `a11y:.:r#1.4.3` is rung `example`; with only the first, `none`", () => {
    expect(itemRecord(two("a11y-union", emptyTest + defaultTest), "a11y:.:m.r#1.4.3")).toMatchObject({
      rung: "example",
    });
    expect(itemRecord(two("a11y-union-first", emptyTest), "a11y:.:m.r#1.4.3")).toMatchObject({ rung: "none" });
  }, 240_000);

  it("a rule violated in any passing run makes the criterion `none`, however many other passing runs ran it clean", () => {
    // a test that expects the E1804 refusal passes with a violation recorded; its tokens are below 4.5:1
    const violated = `
it("refuses text below 4.5:1", async () => {
  const bad = defineTokens({ color: { fg: "#8a8a8a", bg: "#ffffff" } });
  await expect(renderRoute("m.r", { routes, ctx: ctx(), artifacts: { tokens: bad } })).rejects.toMatchObject({ code: "E1804" });
});
`;
    const withImport = (body: string): string => `import { defineTokens } from "@keel/ui";\n${body}`;
    expect(itemRecord(two("a11y-viol-clean", defaultTest), "a11y:.:m.r#1.4.3")).toMatchObject({ rung: "example" });
    expect(
      itemRecord(
        two("a11y-viol-mixed", defaultTest + defaultTest.replace("default", "second") + withImport(violated)),
        "a11y:.:m.r#1.4.3",
      ),
    ).toMatchObject({
      rung: "none",
    });
  }, 240_000);

  it("over every mix of one or two passing tests of a route, given no, empty or explicit artifacts, 1.4.3 is `example` exactly when some run ran E1804", () => {
    const kinds = ["empty", "default", "explicit"] as const;
    const call = { empty: ", artifacts: {}", default: "", explicit: ", artifacts: { tokens }" };
    const mixes: (typeof kinds)[number][][] = [];
    for (const a of kinds) mixes.push([a]);
    for (const a of kinds) for (const b of kinds) if (kinds.indexOf(a) <= kinds.indexOf(b)) mixes.push([a, b]);
    const ids = mixes.map((_, i) => `r${i}`);
    const tests = mixes
      .map((mix, i) =>
        mix
          .map(
            (kind, j) => `
it("mix ${i} test ${j} ${kind}", async () => {
  const h = await renderRoute("m.r${i}", { routes, ctx: ctx()${call[kind]} });
  h.dispose();
});
`,
          )
          .join(""),
      )
      .join("");
    const dir = track(
      keelProject("a11y-mixes", {
        ...moduleFiles(ids, true),
        "tokens.ts": tokensSource("#111111"),
        "modules/m/test/r.test.ts": `${testHead(true)}${tests}`,
      }),
    );
    expect(buildAndTest(dir).status).toBe(0);
    const ledger = keel(dir, ["ledger"]);
    mixes.forEach((mix, i) => {
      const earned = mix.some((kind) => kind !== "empty");
      expect(itemRecord(ledger, `a11y:.:m.r${i}#1.4.3`), mix.join("+")).toMatchObject({
        rung: earned ? "example" : "none",
      });
    });
  }, 300_000);
});
