// Spec: k.cli, clause "After `stdCommand('session', op)`, `keel session` parses argv with `op.input`, runs `op` and emits its records, and the MCP tools include `session`; unfilled, I1055, exit 0; filling it with another `op` throws E1053." (rfc:0070)
// Filled case only (the unfilled case: rules-e1051 and session-unfilled.test.ts). The slot is process-wide and one-shot, so this file fills it once. Seed 1337.
import { mcp, run, stdCommand } from "@keel/cli";
import type { Input, StdOperation } from "@keel/cli";
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED } from "./fixtures";

const seen: Input[] = [];
const op: StdOperation = {
  name: "session",
  description: "session fixture",
  input: s.object({ op: s.string().optional(), target: s.string().optional(), quiet: s.boolean().optional() }),
  output: s.object({ records: s.array(s.object({ kind: s.string() })) }),
  positional: ["op", "target"],
  scope: "none",
  run: async (input) => {
    seen.push(input);
    return { records: [{ kind: "summary", ok: true, name: `session ${input.op}`, counts: {} }], writes: [] };
  },
};
stdCommand("session", op);

describe("k.cli session std command", () => {
  it("keel session runs the filled operation with its parsed positional input", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-z][a-z-]{0,9}$/),
        fc.stringMatching(/^[a-z][a-z0-9.]{0,9}$/),
        async (name, target) => {
          seen.length = 0;
          const r = await run(["session", name, target], { cwd: "/work/app", files: [] });
          expect(r.code).toBe(0);
          expect(seen).toEqual([{ op: name, target }]);
          expect(r.stdout).toContain(`session ${name}`);
        },
      ),
      { seed: SEED, numRuns: 25 },
    );
  });

  it("the MCP tools include session once the slot is filled", async () => {
    const server = mcp(() => ({ cwd: "/work/app", files: [] }));
    const out = await server.receive(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" })}\n`);
    expect(out).toContain('"name":"session"');
  });

  it("an argv the op's input rejects does not run it", async () => {
    seen.length = 0;
    const r = await run(["session", "x", "--nope"], { cwd: "/work/app", files: [] });
    expect(r.code).not.toBe(0);
    expect(seen).toEqual([]);
  });

  it("a fixed slot cannot be refilled with another operation (E1053)", () => {
    expect(() => stdCommand("session", { ...op })).toThrow(/^E1053/);
    expect(() => stdCommand("session", op)).not.toThrow();
  });
});
