// Spec: k.ctx, Rules "... W1608 is a warning: it never fails `keel check` (k.check Diagnostics). No fix."
// Spec: k.check, clause "A tree with only W diagnostics exits 0." Driven through `run`. Seed 1337 (no generated inputs).
import { describe, expect, it } from "vitest";
import { dirtyFile, keel, lines } from "./fixtures";

const dyn = { path: "modules/m/a.ts", source: "export const a = () => import('./b.ts')\n" };

describe("k.ctx W1608 through keel check", () => {
  it("W1608 is a warning: a tree whose only diagnostic is W1608 exits 0 and shows it, and it adds no exit failure beside an error", async () => {
    const r = await keel(["check", "--format=compact"], { files: [dyn] });
    expect(r.code).toBe(0);
    expect(lines(r.stdout).join("\n")).toContain("W1608 modules/m/a.ts:1:");
    const mixed = await keel(["check", "--format=compact"], { files: [dyn, dirtyFile(1)] });
    expect(mixed.code).toBe(1);
  });
});
