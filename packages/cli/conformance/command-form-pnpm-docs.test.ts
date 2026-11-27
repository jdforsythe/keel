// Spec: k.cli, clause "Under pnpm, `pnpm keel docs` in a line is printed as it is."
// Seed 1337 (recorded; no generated inputs). The line is the E1052 of `keel codemod move OrderCard`, which names `keel docs`; run in process.
import { describe, expect, it } from "vitest";
import { keel } from "./fixtures";

describe("k.cli Command form under pnpm", () => {
  it("under pnpm, `pnpm keel docs` in a line is printed as it is", async () => {
    for (const format of ["compact", "pretty"]) {
      const r = await keel(["codemod", "move", "OrderCard", `--format=${format}`], {
        env: { npm_config_user_agent: "pnpm/10.0.0 npm/? node/v22.15.0" },
      });
      const text = `${r.stdout}${r.stderr}`;
      expect(text, format).toContain("pnpm keel docs");
      expect(text, format).not.toContain("pnpm pnpm");
      expect(text, format).not.toMatch(/keel keel/);
    }
  });
});
