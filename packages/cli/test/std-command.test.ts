// stdCommand (k.cli): the reserved `session` slot. The registry is process-wide; each test resets it.
import { beforeEach, describe, expect, it } from "vitest";
import { type Input, mcp, run, stdCommand } from "../src/index.ts";
import { stdSlot } from "../src/internal/stdSlot.ts";
import { makeOp } from "./std-command-support.ts";

const IO = { cwd: "/work/app", files: [] };

beforeEach(() => {
  stdSlot.op = undefined;
});

describe("stdCommand", () => {
  it("accepts only the reserved name session", () => {
    expect(() => stdCommand("check", makeOp("a"))).toThrow(/^E1053/);
    expect(() => stdCommand("nope", makeOp("a"))).toThrow(/^E1053/);
    expect(() => stdCommand("session", makeOp("a"))).not.toThrow();
  });

  it("a different operation throws E1053; the same operation again is idempotent", () => {
    const a = makeOp("a");
    stdCommand("session", a);
    expect(() => stdCommand("session", a)).not.toThrow();
    expect(() => stdCommand("session", makeOp("b"))).toThrow(/^E1053/);
    expect(stdSlot.op).toBe(a);
  });

  it("keel session dispatches to the filled op with parsed positional op and target", async () => {
    const seen: Input[] = [];
    stdCommand("session", makeOp("a", seen));
    const r = await run(["session", "replay", "f.json", "--format=json"], IO);
    expect(r.code).toBe(0);
    expect(seen).toEqual([{ op: "replay", target: "f.json", format: "json" }]);
    expect(r.stdout).toContain("session replay f.json");
  });

  it("an invalid flag is E1052 and the op does not run", async () => {
    const seen: Input[] = [];
    stdCommand("session", makeOp("a", seen));
    const r = await run(["session", "replay", "--bogus"], IO);
    expect(r.code).toBe(2);
    expect(r.stdout + r.stderr).toContain("E1052");
    expect(seen).toEqual([]);
  });

  it("MCP lists and calls session when filled", async () => {
    const seen: Input[] = [];
    stdCommand("session", makeOp("a", seen));
    const server = mcp(() => IO);
    const rpc = (id: number, method: string, params?: unknown): string =>
      `${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`;
    expect(await server.receive(rpc(1, "tools/list"))).toContain('"name":"session"');
    const out = await server.receive(
      rpc(2, "tools/call", { name: "session", arguments: { op: "capture", target: "http://x" } }),
    );
    expect(out).toContain("session capture http://x");
    expect(seen).toEqual([{ op: "capture", target: "http://x" }]);
  });
});
