import { fixedTime } from "@keel/tooling/test-time";
// The vitest task readers: the worker global read as `unknown` and narrowed field by field; axe's rule list checked.
import { afterAll, describe, expect, it } from "vitest";
import { axeRuleList } from "../src/internal/axeRuleList.ts";
import { currentTestBound } from "../src/internal/currentTestBound.ts";
import { currentTestMeta } from "../src/internal/currentTestMeta.ts";
import { onTestEnd } from "../src/internal/onTestEnd.ts";

const ended: string[] = [];
const outside = currentTestBound();
onTestEnd(() => ended.push("module"));

describe("currentTask readers", () => {
  it("give no bound outside a test (module scope runs in the file's task)", () => {
    expect(outside).toBeUndefined();
  });

  it(
    "read the running test's meta, timeout and start",
    () => {
      const meta = currentTestMeta();
      expect(meta).toBeTypeOf("object");
      const bound = currentTestBound();
      expect(bound?.timeout).toBeGreaterThan(0);
      expect(bound?.startedAt).toBeTypeOf("number");
    },
    fixedTime(7_000),
  );

  it("onTestEnd registers on the running test", () => {
    onTestEnd(() => ended.push("test"));
  });

  it("the end ran after the test that registered it, and the module-scope one never", () => {
    expect(ended).toEqual(["test"]);
  });

  afterAll(() => {
    expect(ended).toEqual(["test"]);
  });
});

describe("axeRuleList", () => {
  it("lists every rule with a string id, string tags and a boolean enabled", () => {
    const rules = axeRuleList();
    expect(rules.length).toBeGreaterThan(50);
    for (const r of rules) {
      expect(r.id).toBeTypeOf("string");
      expect(r.enabled).toBeTypeOf("boolean");
      for (const t of r.tags) expect(t).toBeTypeOf("string");
    }
    expect(rules.some((r) => r.id === "color-contrast")).toBe(true);
  });
});
