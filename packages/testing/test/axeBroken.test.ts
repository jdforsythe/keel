// @vitest-environment happy-dom
// k.a11y Render checks: only axe's `incomplete` counts as not run; a requested rule that throws fails the check.
import axeCore from "axe-core";
import { afterEach, describe, expect, it } from "vitest";
import { axe } from "../src/internal/axe.ts";

const ruleNamed = (id: string): object => {
  const audit: unknown = Reflect.get(axeCore, "_audit");
  const rules: unknown = typeof audit === "object" && audit !== null ? Reflect.get(audit, "rules") : undefined;
  const found = Array.isArray(rules)
    ? rules.find((r: unknown) => typeof r === "object" && r !== null && Reflect.get(r, "id") === id)
    : undefined;
  if (typeof found !== "object" || found === null) throw new Error(`no axe rule ${id}`);
  return found;
};

afterEach(() => {
  document.body.innerHTML = "";
});

describe("axe-core failing inside", () => {
  it("is the pinned version 4.14.0, whose internals the harness replays", () => {
    expect(axeCore.version).toBe("4.14.0");
  });

  it("a rule that throws fails the check with E1703 naming the rule", () => {
    const rule = ruleNamed("image-alt");
    const runSync: unknown = Reflect.get(rule, "runSync");
    Reflect.set(rule, "runSync", () => {
      throw new Error("boom");
    });
    try {
      const root = document.createElement("div");
      root.innerHTML = '<img alt="a" src="a.png">';
      document.body.append(root);
      expect(() => axe(root, false)).toThrow(/^E1703 axe-core rule image-alt threw: boom/);
    } finally {
      Reflect.set(rule, "runSync", runSync);
    }
  });
});
