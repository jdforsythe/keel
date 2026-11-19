// Ledger evidence from `explore`, `simulate` and `properties` (k.ledger): only the `@keel/testing` imports, only calls
// that are expected to pass and can run, and only options the ledger can read decide the closed form.
import { describe, expect, it } from "vitest";
import { testEvidence } from "../src/internal/testEvidence.ts";

const T = "packages/a/test/t.test.ts";
const KT = 'import { explore, properties, simulate } from "@keel/testing";\n';
const evidence = (source: string) => testEvidence([{ path: T, source }]).map((r) => r.ev.kind);

describe("testEvidence: explore, simulate and properties", () => {
  it("an explore imported from @keel/testing gives proven or exhaustive; a local function of that name gives nothing", () => {
    expect(evidence(`${KT}it("a", () => { explore([t]); });\nit("b", () => { explore([t], { depth: 2 }); });`)).toEqual(
      ["proven", "exhaustive"],
    );
    expect(evidence('function explore(x: unknown) { return x; }\nit("a", () => { explore([t]); });')).toEqual([
      "example",
    ]);
    expect(evidence('import { explore } from "./mine.ts";\nit("a", () => { explore([t]); });')).toEqual(["example"]);
    expect(evidence('import * as k from "@keel/testing";\nit("a", () => { k.explore([t]); });')).toEqual(["proven"]);
  });

  it("a call expected to throw or reject gives nothing: expect(() => ...), thrownSync, toThrow, rejects", () => {
    const bodies = [
      "expect(() => explore([t])).toThrow();",
      "thrownSync(() => explore([t]));",
      "expect(() => explore([t], { depth: 1 })).toThrowError();",
      "await expect(simulate(async () => {}, { runs: 100, seed: 1 })).rejects.toThrow();",
      "await expect(properties(t, { runs: 100, seed: 1 })).rejects.toMatchObject({});",
    ];
    for (const b of bodies) expect(evidence(`${KT}it("a", async () => { ${b} });`), b).toEqual(["example"]);
    expect(evidence(`${KT}it("a", async () => { expect(explore([t]).complete).toBe(true); });`)).toEqual(["proven"]);
    expect(
      evidence(
        `${KT}it("a", async () => { await expect(simulate(async () => {}, { runs: 100, seed: 1 })).resolves.toBeDefined(); });`,
      ),
    ).toEqual(["property"]);
  });

  it("statically dead calls give nothing: if (false), the else of if (true), after return or throw", () => {
    const bodies = [
      "if (false) explore([t]);",
      "if (true) {} else { explore([t]); }",
      "return; explore([t]);",
      'throw new Error("x"); explore([t]);',
    ];
    for (const b of bodies) expect(evidence(`${KT}it("a", () => { ${b} });`), b).toEqual(["example"]);
    expect(evidence(`${KT}it("a", () => { if (true) explore([t]); });`)).toEqual(["proven"]);
  });

  it("a computed key or a spread argument counts as options given, never the closed form", () => {
    expect(evidence(`${KT}const k = "depth";\nit("a", () => { explore([t], { [k]: 2 }); });`)).toEqual(["exhaustive"]);
    expect(evidence(`${KT}const args = [[t]] as const;\nit("a", () => { explore(...args); });`)).toEqual([
      "exhaustive",
    ]);
    expect(evidence(`${KT}const o = { maxStates: 5 };\nit("a", () => { explore([t], { ...o }); });`)).toEqual([
      "proven",
    ]);
  });
});
