// KEEL_TEST_TIME_SCALE (test-time.ts) and the transform that scales every bound a test file passes to vitest
// (test-times.ts).
import { parseAst } from "vite";
import { describe, expect, it } from "vitest";
import { fixedTime, testTimeScale } from "../test-time.ts";
import { scaler, testTimes } from "../test-times.ts";

const run = (code: string, scale = 0.1): string | undefined => testTimes(code, (c) => parseAst(c), scale);
const VITEST = `import { afterAll, beforeEach, describe, it, test } from "vitest";\n`;
/** The value `code`'s last expression statement evaluates to, with the transform's wrapper defined. */
const evaluate = (expr: string, scale: number): unknown => new Function(`return ${scaler(scale)}(${expr});`)();

describe("testTimeScale", () => {
  it("is 1 unset or empty, the number given otherwise, and throws on anything not a positive number", () => {
    expect(testTimeScale({})).toBe(1);
    expect(testTimeScale({ KEEL_TEST_TIME_SCALE: " " })).toBe(1);
    expect(testTimeScale({ KEEL_TEST_TIME_SCALE: "0.1" })).toBe(0.1);
    expect(testTimeScale({ KEEL_TEST_TIME_SCALE: "2" })).toBe(2);
    for (const bad of ["0", "-1", "x", "Infinity"])
      expect(() => testTimeScale({ KEEL_TEST_TIME_SCALE: bad })).toThrow(/KEEL_TEST_TIME_SCALE/);
  });

  it("fixedTime gives its time as given", () => {
    expect(fixedTime(1234)).toBe(1234);
  });
});

describe("testTimes", () => {
  it("changes nothing at scale 1, or in a file that imports nothing from vitest", () => {
    expect(run(`${VITEST}it("a", () => {}, 60_000);`, 1)).toBeUndefined();
    expect(run(`import { it } from "./mine.ts";\nit("a", () => {}, 60_000);`)).toBeUndefined();
  });

  it("wraps the bound after a test's callback, its options before the callback, and a hook's bound", () => {
    const out = run(
      `${VITEST}it("a", () => {}, 60_000);\ntest("b", { timeout: T }, () => {});\nbeforeEach(() => {}, 2 * T);\nafterAll(close);\ndescribe("c", () => {});`,
    );
    const wrap = scaler(0.1);
    expect(out).toContain(`it("a", () => {}, ${wrap}(60_000));`);
    expect(out).toContain(`test("b", ${wrap}({ timeout: T }), () => {});`);
    expect(out).toContain(`beforeEach(() => {}, ${wrap}(2 * T));`);
    expect(out).toContain("afterAll(close);");
    expect(out).toContain(`describe("c", () => {});`);
  });

  it("follows modifiers, each tables and aliased imports, and keeps every line where it was", () => {
    const code = `import { it as check } from "vitest";\ncheck.concurrent("a", async () => {}, 9);\ncheck.each([1])("b %i", (n) => {}, 30);\ncheck.skipIf(false)("c", { timeout: 40 }, () => {});`;
    const out = run(code) ?? "";
    expect(out.match(/Math\.max/g)?.length).toBe(6);
    expect(out.split("\n").length).toBe(code.split("\n").length);
  });

  it("the wrapper scales a number and an options object's timeout, at least 1 ms, and passes anything else through", () => {
    expect(evaluate("60000", 0.1)).toBe(6000);
    expect(evaluate("{ timeout: 30000, retry: 2 }", 0.5)).toEqual({ timeout: fixedTime(15000), retry: 2 });
    expect(evaluate("{ retry: 2 }", 0.1)).toEqual({ retry: 2 });
    expect(evaluate("3", 0.1)).toBe(1);
    expect(evaluate("undefined", 0.1)).toBeUndefined();
  });
});
