import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { apply } from "../conformance/fixtures.ts";

// Stryker runs tests from a sandbox under packages/scaffold, so find the root by marker.
function repoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(join(dir, "pnpm-workspace.yaml"))) {
    const up = dirname(dir);
    if (up === dir) throw new Error("pnpm-workspace.yaml not found above the test file");
    dir = up;
  }
  return dir;
}

describe("project template carries the Keel brand (docs/BRAND.md)", () => {
  const empty = new Map<string, string>();
  const standalone = apply("project", { name: "shop" }, empty).files;
  const workspace = apply("project", { name: "shop", workspace: true }, empty).files;

  it("tokens.ts re-exports brandTokens from @keel/ui/brand", () => {
    expect(standalone.get("tokens.ts")).toBe(
      'import { brandTokens } from "@keel/ui/brand";\n\nexport const tokens = brandTokens;\n',
    );
  });
  it("public/keel-mark.svg is byte-identical to docs/brand/keel-mark.svg", () => {
    const mark = readFileSync(join(repoRoot(), "docs/brand/keel-mark.svg"), "utf8");
    expect(standalone.get("public/keel-mark.svg")).toBe(mark);
    expect(workspace.get("public/keel-mark.svg")).toBe(mark);
  });
  it("the deployable loads the self-hosted fonts through styles, and no index.html is written", () => {
    for (const files of [standalone, workspace]) {
      expect(files.get("topology.ts")).toContain('styles: ["@keel/ui/fonts"]');
      expect(files.has("index.html")).toBe(false);
    }
  });
});

describe("project template writes a .gitignore", () => {
  const empty = new Map<string, string>();
  for (const workspace of [false, true]) {
    it(`ignores build and tool output and keeps .keel committed (workspace: ${workspace})`, () => {
      const text = apply("project", { name: "shop", workspace }, empty).files.get(".gitignore") ?? "";
      const lines = text.split("\n");
      for (const l of ["node_modules", "dist", ".keel-dev/", ".keel/sessions/"]) expect(lines).toContain(l);
      expect(lines).not.toContain(".keel/");
      expect(lines).not.toContain(".keel/std.json");
    });
  }
});
