// Mutation-killing tests for `run` (mcp/lsp serving, usage errors) and `render` (grouping, caps, filters).
import { describe, expect, it } from "vitest";
import { run } from "../src/index.ts";
import { render } from "../src/internal/render.ts";
import type { OutRecord } from "../src/types/OutRecord.ts";

const CWD = "/work/app";
const rpc = (id: number, method: string, params: unknown) => JSON.stringify({ jsonrpc: "2.0", id, method, params });
const frame = (m: unknown, extra = 0): string => {
  const body = JSON.stringify(m);
  return `Content-Length: ${new TextEncoder().encode(body).length + extra}\r\n\r\n${body}`;
};
async function* chunks(...parts: string[]): AsyncIterable<string> {
  for (const p of parts) yield p;
}
const TWO = "export const a = 1\nexport const b = 2\n";

describe("run: mcp and lsp", () => {
  it("extra arguments are E1052 with the first 30 characters of the first one", async () => {
    const long = "y".repeat(40);
    for (const head of ["mcp", "lsp"]) {
      const r = await run([head, long, "z"], { cwd: CWD });
      expect(r).toEqual({
        code: 2,
        stdout: `E1052 ${head} takes no arguments: ${"y".repeat(30)}\n  see: k.cli\nfail ${head} 1 errors\n`,
        stderr: "",
      });
    }
  });

  it("a string stdin is served in one batch; no stdin serves nothing", async () => {
    expect(await run(["mcp"], { cwd: CWD })).toEqual({ code: 0, stdout: "", stderr: "" });
    expect(await run(["lsp"], { cwd: CWD })).toEqual({ code: 0, stdout: "", stderr: "" });
  });

  it("mcp: a request without a trailing newline is still served, also when the text starts with a newline", async () => {
    const want = { jsonrpc: "2.0", id: 1, result: {} };
    expect(await run(["mcp"], { cwd: CWD, stdin: rpc(1, "ping", {}) })).toEqual({
      code: 0,
      stdout: `${JSON.stringify(want)}\n`,
      stderr: "",
    });
    expect((await run(["mcp"], { cwd: CWD, stdin: `\n${rpc(1, "ping", {})}` })).stdout).toBe(
      `${JSON.stringify(want)}\n`,
    );
    expect((await run(["mcp"], { cwd: CWD, stdin: `${rpc(1, "ping", {})}\n` })).stdout).toBe(
      `${JSON.stringify(want)}\n`,
    );
  });

  it("lsp: input is not given a trailing newline (a frame one byte short of its length stays pending)", async () => {
    const msg = { jsonrpc: "2.0", id: 1, method: "shutdown" };
    expect((await run(["lsp"], { cwd: CWD, stdin: frame(msg) })).stdout).toContain('"result":null');
    expect(await run(["lsp"], { cwd: CWD, stdin: frame(msg, 1) })).toEqual({ code: 0, stdout: "", stderr: "" });
  });

  it("mcp tools run on the io given to run", async () => {
    const files = [{ path: "src/a.ts", source: TWO }];
    const r = await run(["mcp"], {
      cwd: CWD,
      files,
      stdin: `${rpc(1, "tools/call", { name: "check", arguments: { format: "json" } })}\n`,
    });
    expect(r.stdout).toContain("E1752");
  });

  it("lsp diagnostics are computed on the io given to run", async () => {
    const uri = `file://${CWD}/src/a.ts`;
    const r = await run(["lsp"], {
      cwd: CWD,
      files: [],
      stdin: frame({
        jsonrpc: "2.0",
        method: "textDocument/didOpen",
        params: { textDocument: { uri, text: TWO } },
      }),
    });
    expect(r.stdout).toContain('"code":"E1752"');
  });

  it("a streamed stdin without emit is collected into stdout, with exit 0 and empty stderr", async () => {
    const r = await run(["mcp"], {
      cwd: CWD,
      files: [],
      stdin: chunks(`${rpc(1, "ping", {})}\n`, `${rpc(2, "ping", {})}\n`),
    });
    expect(r).toEqual({
      code: 0,
      stdout: `${JSON.stringify({ jsonrpc: "2.0", id: 1, result: {} })}\n${JSON.stringify({ jsonrpc: "2.0", id: 2, result: {} })}\n`,
      stderr: "",
    });
    const l = await run(["lsp"], { cwd: CWD, stdin: chunks(frame({ jsonrpc: "2.0", id: 1, method: "shutdown" })) });
    expect(l.stdout).toContain('"result":null');
  });

  it("a streamed stdin with emit hands output to emit and returns none; tools see the io", async () => {
    const seen: string[] = [];
    const r = await run(["mcp"], {
      cwd: CWD,
      files: [{ path: "src/a.ts", source: TWO }],
      emit: (t) => void seen.push(t),
      stdin: chunks(`${rpc(1, "tools/call", { name: "check", arguments: { format: "json" } })}\n`),
    });
    expect(r).toEqual({ code: 0, stdout: "", stderr: "" });
    expect(seen.join("")).toContain("E1752");
  });
});

describe("render", () => {
  const o = {
    mode: "compact",
    quiet: false,
    limit: undefined,
    verbose: false,
    code: undefined,
    command: "check",
  } as const;
  const diag = (code: string, n: number): OutRecord => ({
    kind: "diag",
    code,
    path: "a.ts",
    line: n,
    col: 1,
    message: `m${n}`,
  });
  const sum: OutRecord = { kind: "summary", ok: false, name: "check", counts: { errors: 1 } };

  it("a record of a kind without a formatter renders nothing", () => {
    expect(render([{ kind: "no.such.kind" }], o)).toBe("");
    expect(render([{ kind: "no.such.kind" }, diag("E0001", 1)], o)).toBe("E0001 a.ts:1:1 m1\n");
  });

  it("no records at all is the empty string", () => {
    expect(render([], o)).toBe("");
    expect(render([], { ...o, quiet: true })).toBe("");
  });

  it("--code keeps the matching diagnostics and every other kind", () => {
    const rs: OutRecord[] = [
      diag("E0001", 1),
      diag("E0002", 2),
      { kind: "scaffold.edit", action: "create", path: "p" },
      sum,
    ];
    expect(render(rs, { ...o, code: "E0001" })).toBe("E0001 a.ts:1:1 m1\ncreate p\nfail check 1 errors\n");
    expect(render(rs, o)).toBe("E0001 a.ts:1:1 m1\nE0002 a.ts:2:1 m2\ncreate p\nfail check 1 errors\n");
  });

  it("diagnostics are capped per code at 5 by default and the hint names the code", () => {
    const rs = [1, 2, 3, 4, 5, 6, 7].map((n) => diag("E0009", n));
    const out = render(rs, o).split("\n");
    expect(out.slice(0, 5)).toEqual([1, 2, 3, 4, 5].map((n) => `E0009 a.ts:${n}:1 m${n}`));
    expect(out[5]).toBe("... +2 more E0009 (keel check --code E0009)");
    expect(render(rs, { ...o, verbose: true }).split("\n")).toHaveLength(8);
    expect(render(rs, { ...o, limit: 2 }).split("\n")[2]).toBe("... +5 more E0009 (keel check --code E0009)");
    expect(render(rs, { ...o, mode: "json" }).split("\n")).toHaveLength(8);
  });

  it("other kinds are uncapped unless --limit, whose hint names the kind and the full count", () => {
    const edits: OutRecord[] = ["a", "b", "c", "d", "e", "f", "g"].map((p) => ({
      kind: "scaffold.edit",
      action: "create",
      path: p,
    }));
    expect(render(edits, o).split("\n")).toHaveLength(8);
    const out = render(edits, { ...o, limit: 3, command: "scaffold" }).split("\n");
    expect(out.slice(0, 3)).toEqual(["create a", "create b", "create c"]);
    expect(out[3]).toBe("... +4 more scaffold.edit (keel scaffold --limit 7)");
    expect(render(edits, { ...o, limit: 3, mode: "json" }).split("\n")).toHaveLength(4);
  });

  it("--quiet keeps the trailer only", () => {
    expect(render([diag("E0001", 1), sum], { ...o, quiet: true })).toBe("fail check 1 errors\n");
  });
});
