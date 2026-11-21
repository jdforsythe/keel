// Spec: std.report, clause "With the tools entry not imported and a project without `@keel/std-report` in its `deps`, `keel report` emits I1055 and exits 0. With it imported, the MCP tools include `report`, and `stdCommand('report', op)` with another `op` throws E1053."
// This file tests the second sentence only; the first is keel-report-unfilled.test.ts.
// Seed 1337 (no random inputs)
import { mcp, stdCommand } from "@keel/cli";
import type { StdOperation } from "@keel/cli";
import { s } from "@keel/schema";
import "@keel/std-report/tools";
import { expect, test } from "vitest";

const other: StdOperation = {
  name: "report",
  description: "another report operation",
  input: s.object({}),
  output: s.object({ records: s.array(s.object({ kind: s.string() })) }),
  positional: [],
  scope: "none",
  run: async () => ({ records: [], writes: [] }),
};

test("With it imported, the MCP tools include `report`, and `stdCommand('report', op)` with another `op` throws E1053.", async () => {
  const server = mcp(() => ({ cwd: "/work/app", files: [] }));
  const out = await server.receive(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" })}\n`);
  expect(out).toContain('"name":"report"');
  expect(() => stdCommand("report", other)).toThrow(/E1053/);
});
