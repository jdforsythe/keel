// Ledger evidence from `prove` (k.ledger, k.prove): a passing call of `@keel/testing/prove`'s `prove`, one the test
// body awaits or returns so its rejection fails the test, is `proven` and names the Z3 version; without an installed
// Z3, a call expected to reject, one whose rejection is handled or not awaited, or a local `prove`, it is `example`.
import { describe, expect, it } from "vitest";
import { buildLedger } from "../src/internal/buildLedger.ts";
import { testEvidence } from "../src/internal/testEvidence.ts";
import { z3Version } from "../src/internal/z3Version.ts";

const T = "packages/a/test/t.test.ts";
const KP = 'import { prove } from "@keel/testing/prove";\n';
const evidence = (source: string, z3: string | undefined) =>
  testEvidence([{ path: T, source }], new Set(), z3).map((r) => r.ev);

describe("testEvidence: prove", () => {
  it("a prove imported from @keel/testing/prove gives proven with the Z3 version", () => {
    expect(evidence(`${KP}it("a", async () => { await prove([t]); });`, "5.3.3")).toEqual([
      { kind: "proven", passed: true, z3: "5.3.3" },
    ]);
    expect(
      evidence('import * as p from "@keel/testing/prove";\nit("a", async () => { await p.prove([t]); });', "5.3.3"),
    ).toEqual([{ kind: "proven", passed: true, z3: "5.3.3" }]);
  });

  it("without Z3, rejected, local or from elsewhere: example", () => {
    const cases = [
      [`${KP}it("a", async () => { await prove([t]); });`, undefined],
      [`${KP}it("a", async () => { await expect(prove([t])).rejects.toMatchObject({ code: "E1716" }); });`, "5.3.3"],
      ['function prove(x: unknown) { return x; }\nit("a", () => { prove([t]); });', "5.3.3"],
      ['import { prove } from "@keel/testing";\nit("a", () => { prove([t]); });', "5.3.3"],
    ] as const;
    for (const [src, z3] of cases)
      expect(
        evidence(src, z3).map((e) => e.kind),
        src,
      ).toEqual(["example"]);
  });

  it("a prove the body awaits or returns, at its top level, decides the test: proven", () => {
    const bodies = [
      "async () => { await prove([t]); }",
      "() => { return prove([t]); }",
      "() => prove([t])",
      "async () => await prove([t])",
      "async () => { const r = await prove([t]); expect(r.proven).toEqual(['t']); }",
      "async () => { const x = 1; expect(x).toBe(1); await prove([t]); }",
      "async function () { await prove([t]); }",
    ];
    for (const body of bodies)
      expect(
        evidence(`${KP}it("a", ${body});`, "5.3.3").map((e) => e.kind),
        body,
      ).toEqual(["proven"]);
  });

  it("a prove whose rejection is handled, not awaited, or inside a branch, callback, try or helper: example", () => {
    const bodies = [
      "() => { prove([t]); }",
      "async () => { void prove([t]); }",
      "async () => { await prove([t]).catch(() => undefined); }",
      "async () => { await prove([t]).then(() => null, (e) => e); }",
      "async () => { await prove([t]).finally(() => undefined); }",
      "async () => { try { await prove([t]); } catch {} }",
      "async () => { try { await prove([t]); } finally {} }",
      "async () => { await expect(prove([t])).rejects.toThrow('E1716'); }",
      "async () => { await expect(prove([t])).resolves.toBeDefined(); }",
      "async () => { await expect(prove([t]).catch((e) => e)).resolves.toBeDefined(); }",
      "async () => { await Promise.allSettled([prove([t])]); }",
      "async () => { await Promise.all([prove([t])]); }",
      "async () => { if (ok) await prove([t]); }",
      "async () => { if (ok) { await prove([t]); } }",
      "async () => { ok ? await prove([t]) : undefined; }",
      "async () => { for (const x of xs) await prove([x]); }",
      "async () => { expect(await rejection(() => prove([t]))).toBeUndefined(); }",
      "async () => { await run(async () => { await prove([t]); }); }",
      "async () => { return; await prove([t]); }",
      "async () => { const p = prove([t]); expect(p).toBeDefined(); }",
    ];
    for (const body of bodies)
      expect(
        evidence(`${KP}it("a", ${body});`, "5.3.3").map((e) => e.kind),
        body,
      ).toEqual(["example"]);
    const helper = `${KP}const check = async () => { await prove([t]); };\nit("a", async () => { await check(); });`;
    expect(evidence(helper, "5.3.3").map((e) => e.kind)).toEqual(["example"]);
  });

  it("buildLedger names the installed z3-solver's version", () => {
    expect(z3Version()).toMatch(/^\d+\.\d+\.\d+$/);
    const { items } = buildLedger([
      { path: "packages/a/src/inc.ts", source: "export const inc = 1;\n" },
      { path: T, source: `${KP}import { inc } from "../src/inc.ts";\nit("a", async () => { await prove([inc]); });` },
    ]);
    expect(items.find((i) => i.item === "packages/a/src/inc.ts#inc")?.evidence.map((e) => e.ev)).toEqual([
      { kind: "proven", passed: true, z3: z3Version() },
    ]);
  });
});
