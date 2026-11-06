// Spec: k.cli "One engine": `keel mcp` and `keel lsp` serve the same engine.
// Untestable: the spec names no programmatic mcp()/lsp() factory or commands() list, so surface parity (same diagnostics, MCP input schema equals operation input JSON Schema) cannot be exercised through a public API without inventing one.
import { describe, expect, it } from "vitest";
import { keel } from "./fixtures";

describe("k.cli surfaces", () => {
  it("`mcp` and `lsp` are recognized subcommands, not E1051", async () => {
    for (const cmd of ["mcp", "lsp"]) {
      const r = await keel([cmd, "--help"]);
      expect(r.stdout + r.stderr).not.toContain("E1051");
    }
  });
});
