import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { apply } from "../conformance/fixtures.ts";

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
    const mark = readFileSync(new URL("../../../docs/brand/keel-mark.svg", import.meta.url), "utf8");
    expect(standalone.get("public/keel-mark.svg")).toBe(mark);
    expect(workspace.get("public/keel-mark.svg")).toBe(mark);
  });
  it("workspace index.html loads the self-hosted fonts and renders the mark in a header", () => {
    const html = workspace.get("index.html") ?? "";
    expect(html).toContain('import "@keel/ui/fonts"');
    expect(html).toContain("<header>");
    expect(html).toContain('src="/keel-mark.svg"');
    expect(html).not.toMatch(/https?:\/\//);
  });
});
