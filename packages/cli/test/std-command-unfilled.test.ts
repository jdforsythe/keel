// The `session` and `report` slots stay empty in this file: I1055 and no MCP tool (k.cli).
import { describe, expect, it } from "vitest";
import { mcp, run } from "../src/index.ts";

describe("session slot, unfilled", () => {
  it("keel session reports I1055 with exit 0", async () => {
    const r = await run(["session", "capture"], { cwd: "/work/app", files: [] });
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("I1055");
  });

  it("keel report reports I1055 naming the report module, exit 0", async () => {
    const r = await run(["report", "--format=compact"], { cwd: "/work/app", files: [] });
    expect(r.code).toBe(0);
    expect(r.stdout).toBe("I1055 report not available: needs the stdlib report module\n  see: k.cli\nok report\n");
  });

  it("MCP lists no session tool", async () => {
    const out = await mcp(() => ({ cwd: "/work/app", files: [] })).receive(
      `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" })}\n`,
    );
    expect(out).not.toContain('"session"');
    expect(out).not.toContain('"name":"report"');
  });
});
