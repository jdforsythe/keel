// Ledger evidence from `prove` (k.ledger, k.prove): a passing call of `@keel/testing/prove`'s `prove` is `proven` and
// names the Z3 version; without an installed Z3, a call expected to reject, or a local `prove`, it is `example`.
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
