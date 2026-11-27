// Spec: k.cli Rules (E1052: a required flag or argument missing, named as written with a command line that passes it)
// and Command form (a `keel` already in a manager's form is left as it is).
import type { Op } from "@keel/scaffold";
import { describe, expect, it } from "vitest";
import { missingInput } from "../src/internal/missingInput.ts";
import { runEngine } from "../src/internal/runEngine.ts";

const PNPM = { npm_config_user_agent: "pnpm/10.0.0 node/v22.15.0" };

describe("E1052 for a missing input", () => {
  it("names a flag with its value and an argument in angle brackets", () => {
    expect(missingInput("move", "to")).toBe("move needs --to <module>, as in keel codemod move OrderCard --to catalog");
    expect(missingInput("library", "name")).toBe("library needs <name>, as in keel scaffold library @acme/charts");
    expect(missingInput("route", "id")).toBe("route needs <id>, as in keel scaffold route orders.about");
  });

  it("each operation's required inputs fit docs/OUTPUT.md's bound in the longest manager form", () => {
    const required: readonly (readonly [Op, string])[] = [
      ["project", "name"],
      ["module", "id"],
      ["route", "id"],
      ["component", "id"],
      ["store", "id"],
      ["transaction", "id"],
      ["service", "id"],
      ["shell", "shell"],
      ["library", "name"],
      ["rename", "from"],
      ["rename", "to"],
      ["move", "name"],
      ["move", "to"],
      ["place", "module"],
      ["place", "to"],
      ["add-field", "schema"],
      ["add-field", "field"],
      ["add-field", "type"],
    ];
    for (const [op, field] of required)
      expect(missingInput(op, field).replace("keel ", "npx --no keel ").length).toBeLessThanOrEqual(89);
  });

  it("keel codemod move with no --to prints the flag and the line in pnpm's form, once", async () => {
    const e = await runEngine(["codemod", "move", "OrderCard"], { cwd: "/p", files: [], env: PNPM });
    expect(e.result.code).toBe(2);
    expect(e.result.stdout).toContain("move needs --to <module>, as in pnpm keel codemod move OrderCard --to catalog");
    expect(e.result.stdout).not.toContain("pnpm pnpm");
    expect(e.result.stdout).not.toContain("move:1:1");
  });
});
