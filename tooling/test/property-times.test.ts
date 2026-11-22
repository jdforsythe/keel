import { parseAst } from "vite";
import { describe, expect, it } from "vitest";
import { PER_RUN_MS, propertyTimes } from "../property-times.ts";

const IMPORT = `import { properties, simulate } from "@keel/testing";\n`;
const times = (body: string, testTimeout = 5000): string | undefined =>
  propertyTimes(IMPORT + body, (c) => parseAst(c), testTimeout);

describe("propertyTimes", () => {
  it("gives a properties test PER_RUN_MS for each default run", () => {
    expect(times(`it("p", async () => { await properties(Page); });`)).toBe(
      `${IMPORT}it("p", { timeout: ${100 * PER_RUN_MS} }, async () => { await properties(Page); });`,
    );
  });
  it("reads a literal runs and sums the calls in one test", () => {
    const out = times(
      `test("p", async () => { await properties(A, { runs: 50, seed: 1 }); await simulate(async () => {}, { runs: 20 }); });`,
    );
    expect(out).toContain(`test("p", { timeout: ${70 * PER_RUN_MS} }, async`);
  });
  it("never gives less than the configured test timeout", () => {
    expect(times(`it("p", async () => { await properties(A, { runs: 1 }); });`, 9000)).toContain("{ timeout: 9000 }");
  });
  it("times it.only, test.concurrent and a function expression", () => {
    const out = times(
      `it.only("a", async () => { await properties(A); });\ntest.concurrent("b", async function () { await properties(B); });`,
    );
    expect(out?.match(/\{ timeout: 30000 \}/g)).toHaveLength(2);
  });
  it("follows an import alias", () => {
    const code = `import { properties as props } from "@keel/testing";\nit("p", async () => { await props(A, { runs: 10 }); });`;
    expect(propertyTimes(code, (c) => parseAst(c), 0)).toContain(`{ timeout: ${10 * PER_RUN_MS} }`);
  });
  it("leaves a test that declares its options, one with no timed call, and one whose properties is not Keel's", () => {
    expect(times(`it("p", { timeout: 1 }, async () => { await properties(A); });`)).toBeUndefined();
    expect(times(`it("p", () => { expect(1).toBe(1); });`)).toBeUndefined();
    const other = `import { properties } from "./mine.ts";\nit("p", async () => { await properties(A); });`;
    expect(propertyTimes(other, (c) => parseAst(c), 5000)).toBeUndefined();
  });
  it("inserts at UTF-16 offsets, so a test named in another script keeps its text", () => {
    const out = times(`it("日本語", async () => { await properties(A); });\nit("b", async () => { await properties(B); });`);
    expect(out).toContain(`it("日本語", { timeout: 30000 }, async`);
    expect(out).toContain(`it("b", { timeout: 30000 }, async`);
  });
  it("keeps every line where it was", () => {
    const body = `describe("d", () => {\n  it("p", async () => {\n    await properties(A);\n  });\n});\n`;
    expect(times(body)?.split("\n").length).toBe((IMPORT + body).split("\n").length);
  });
});
