// Spec: k.cli, clause "After `stdCommand('session', op)`, `keel session` parses argv with `op.input`, runs `op` and emits its records, and the MCP tools include `session`; unfilled, I1055, exit 0; filling it with another `op` throws E1053." (rfc:0070)
// Unfilled case: this file never fills the slot. Seed 1337.
import { mcp, run } from "@keel/cli";
import { expect, test } from "vitest";

test("unfilled, keel session reports I1055 with exit 0 and the MCP tools have no session", async () => {
  const r = await run(["session", "replay", "a.json"], { cwd: "/work/app", files: [] });
  expect(r.code).toBe(0);
  expect(r.stdout).toContain("I1055");
  const server = mcp(() => ({ cwd: "/work/app", files: [] }));
  const out = await server.receive(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" })}\n`);
  expect(out).not.toContain('"name":"session"');
});
