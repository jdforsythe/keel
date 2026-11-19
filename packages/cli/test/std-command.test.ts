// stdCommand (k.cli): the reserved `session` and `report` slots. The registry is process-wide; each test resets it.
import { beforeEach, describe, expect, it } from "vitest";
import { type Input, mcp, run, stdCommand } from "../src/index.ts";
import { stdSlot } from "../src/internal/stdSlot.ts";
import { makeOp } from "./std-command-support.ts";

const IO = { cwd: "/work/app", files: [] };

beforeEach(() => {
  stdSlot.clear();
});

describe("stdCommand", () => {
  it("accepts only the reserved names session and report", () => {
    expect(() => stdCommand("check", makeOp("a"))).toThrow(/^E1053 std command check is not reserved$/);
    expect(() => stdCommand("nope", makeOp("a"))).toThrow(/^E1053/);
    expect(() => stdCommand("session", makeOp("a"))).not.toThrow();
    expect(() => stdCommand("report", makeOp("a", [], "report"))).not.toThrow();
  });

  it("the two slots are filled apart: a different report operation throws E1053 naming report", () => {
    const s = makeOp("a");
    const r = makeOp("a", [], "report");
    stdCommand("session", s);
    stdCommand("report", r);
    expect(() => stdCommand("report", r)).not.toThrow();
    expect(() => stdCommand("report", makeOp("b", [], "report"))).toThrow(
      /^E1053 std command report registered twice$/,
    );
    expect(() => stdCommand("session", makeOp("b"))).toThrow(/^E1053 std command session registered twice$/);
    expect(stdSlot.get("session")).toBe(s);
    expect(stdSlot.get("report")).toBe(r);
  });

  it("keel report dispatches to the filled report op; keel session stays unfilled", async () => {
    const seen: Input[] = [];
    stdCommand("report", makeOp("a", seen, "report"));
    const r = await run(["report", "http://x", "--format=json"], IO);
    expect(r.code).toBe(0);
    expect(seen).toEqual([{ op: "http://x", format: "json" }]);
    expect(r.stdout).toContain("report http://x");
    const unfilled = await run(["session", "capture", "--format=compact"], IO);
    expect(unfilled.code).toBe(0);
    expect(unfilled.stdout).toBe(
      "I1055 session not available: needs the stdlib session module\n  see: k.cli\nok session\n",
    );
  });

  it("MCP lists and calls report when filled, after session when both are", async () => {
    const seen: Input[] = [];
    stdCommand("session", makeOp("a"));
    stdCommand("report", makeOp("a", seen, "report"));
    const server = mcp(() => IO);
    const rpc = (id: number, method: string, params?: unknown): string =>
      `${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`;
    const list = await server.receive(rpc(1, "tools/list"));
    expect(list.indexOf('"name":"session"')).toBeGreaterThan(0);
    expect(list.indexOf('"name":"report"')).toBeGreaterThan(list.indexOf('"name":"session"'));
    expect(await server.receive(rpc(2, "tools/call", { name: "report", arguments: { op: "http://x" } }))).toContain(
      "report http://x",
    );
    expect(seen).toEqual([{ op: "http://x" }]);
  });

  it("a different operation throws E1053; the same operation again is idempotent", () => {
    const a = makeOp("a");
    stdCommand("session", a);
    expect(() => stdCommand("session", a)).not.toThrow();
    expect(() => stdCommand("session", makeOp("b"))).toThrow(/^E1053/);
    expect(stdSlot.get("session")).toBe(a);
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
