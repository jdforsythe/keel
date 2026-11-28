// @vitest-environment happy-dom
// k.a11y Claims: the harness records each render check in the test's meta; `@keel/testing/a11y` maps rules to
// criteria and writes reports/a11y.json. Property seed: 1337.
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { render, renderRoute } from "@keel/testing";
import { WCAG_CRITERIA, a11yRules, criteriaOf, writeA11yReport } from "@keel/testing/a11y";
import type { A11yRun } from "@keel/testing/a11y";
import { tempDir } from "@keel/tooling/test-tmp";
import { Button, Text } from "@keel/ui";
import { defineTokens } from "@keel/ui/tokens";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const SEED = 1337;
const Save = Object.assign(() => Button({ id: "r.save", children: "Save" }), { Props: s.object({}) });

describe("criteriaOf", () => {
  it("maps Keel's codes by k.a11y's table", () => {
    expect(criteriaOf("E1702")).toEqual(["4.1.2"]);
    expect(criteriaOf("E1802")).toEqual(["1.1.1", "1.3.1", "2.4.4", "4.1.2"]);
    expect(criteriaOf("E1804")).toEqual(["1.4.3"]);
    expect(criteriaOf("E1820")).toEqual(["1.3.2", "2.4.3"]);
    expect(criteriaOf("E1821")).toEqual(["1.3.5"]);
  });

  it("maps axe-core rules by their wcag tags, and anything else to none", () => {
    expect(criteriaOf("image-alt")).toEqual(["1.1.1"]);
    expect(criteriaOf("document-title")).toEqual(["2.4.2"]);
    expect(criteriaOf("html-has-lang")).toEqual(["3.1.1"]);
    expect(criteriaOf("landmark-unique")).toEqual([]);
    expect(criteriaOf("no-such-rule")).toEqual([]);
  });

  it("every rule's criteria are WCAG 2.2 A or AA criteria (property)", () => {
    fc.assert(
      fc.property(fc.constantFrom(...a11yRules(), "E1802", "E1820"), (rule) => {
        for (const c of criteriaOf(rule)) expect(WCAG_CRITERIA).toContain(c);
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("a11yRules holds the document rules and Keel's render codes, not color-contrast", () => {
    const rules = a11yRules();
    for (const r of [
      "document-title",
      "html-has-lang",
      "landmark-one-main",
      "region",
      "bypass",
      "E1702",
      "E1804",
      "E1821",
    ])
      expect(rules).toContain(r);
    expect(rules).not.toContain("color-contrast");
    expect(WCAG_CRITERIA).toHaveLength(55);
  });
});

describe("the harness records each render check in the test's meta", () => {
  it("a component render records the component and the element rules", ({ task }) => {
    const t = render(Save, { props: {}, artifacts: {} });
    t.dispose();
    const recorded: unknown = Reflect.get(task.meta, "a11y");
    const [check] = Array.isArray(recorded) ? recorded : [];
    expect(check).toMatchObject({ route: null, component: "anonymous", violations: [] });
    expect(check.rules).toContain("button-name");
    expect(check.rules).toContain("E1821");
    expect(check.rules).not.toContain("document-title");
    expect(check.rules).not.toContain("E1804");
  });

  it("a route render records its id, the document rules, E1804 with tokens, and a violation", async ({ task }) => {
    const tokens = defineTokens({ color: { fg: "#999999", bg: "#ffffff" } });
    const c = contract("rec", { "rec.page": { path: "/rec" } });
    const routes = manifest(c, {
      "rec.page": { component: () => Text({ id: "rec.msg", fg: "fg", children: "x" }), title: () => "R" },
    });
    await expect(renderRoute("rec.page", { routes, artifacts: { tokens } })).rejects.toMatchObject({ code: "E1804" });
    const recorded: unknown = Reflect.get(task.meta, "a11y");
    const [check] = Array.isArray(recorded) ? recorded : [];
    expect(check).toMatchObject({
      route: "rec.page",
      component: null,
      violations: [{ rule: "E1804", element: "rec.msg" }],
    });
    expect(check.rules).toContain("document-title");
    expect(check.rules).toContain("E1804");
  });
});

describe("writeA11yReport", () => {
  it("writes reports/a11y.json ordered by file and test, skipping malformed entries", () => {
    const root = tempDir("keel-a11y-");
    try {
      const check = { route: "m.r", component: null, rules: ["E1804"], violations: [] };
      const runs = writeA11yReport(root, [
        { file: "b.test.ts", test: "b", passed: true, meta: { a11y: [check] } },
        { file: "a.test.ts", test: "a", passed: false, meta: { a11y: [check, { route: 3 }] } },
        { file: "a.test.ts", test: "none", passed: true, meta: {} },
      ]);
      const want: A11yRun[] = [
        { ...check, file: "a.test.ts", test: "a", passed: false },
        { ...check, file: "b.test.ts", test: "b", passed: true },
      ];
      expect(runs).toEqual(want);
      expect(JSON.parse(readFileSync(join(root, "reports", "a11y.json"), "utf8"))).toEqual(want);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
