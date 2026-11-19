// Spec: std.report, clause "With the tools entry not imported and a project without `@keel/std-report` in its `deps`, `keel report` emits I1055 and exits 0."
// Seed 1337 (no random inputs)
// The command slot is process-wide: this file never imports the tools entry.
import { mcp, run } from "@keel/cli";
import { expect, test } from "vitest";

test("With the tools entry not imported and a project without `@keel/std-report` in its `deps`, `keel report` emits I1055 and exits 0.", async () => {
  const r = await run(["report", "--format=compact"], { cwd: "/work/app", files: [] });
  expect(r.code).toBe(0);
  expect(r.stdout).toContain("I1055");
  const server = mcp(() => ({ cwd: "/work/app", files: [] }));
  const out = await server.receive(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" })}\n`);
  expect(out).not.toContain('"name":"report"');
});
