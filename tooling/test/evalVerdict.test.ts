import { describe, expect, it } from "vitest";
import { verdict } from "../../evals/verdict.ts";

describe("eval verdict", () => {
  const cases: Array<[number, number, boolean, boolean]> = [];
  for (const checkExit of [0, 1])
    for (const testExit of [0, 1])
      for (const passed of [true, false])
        cases.push([checkExit, testExit, passed, checkExit === 0 && testExit === 0 && passed]);
  it.each(cases)("check %i, test %i, pass %s gives %s", (checkExit, testExit, passed, want) => {
    expect(verdict({ checkExit, testExit, passed })).toBe(want);
  });
  it("only the all-green combination converges", () => {
    expect(cases.filter((c) => c[3])).toHaveLength(1);
  });
  it("a pass.ts result that is not exactly true does not converge", () => {
    expect(verdict({ checkExit: 0, testExit: 0, passed: "yes" })).toBe(false);
    expect(verdict({ checkExit: 0, testExit: 0, passed: undefined })).toBe(false);
  });
});
