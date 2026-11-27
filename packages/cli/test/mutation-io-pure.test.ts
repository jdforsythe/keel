// Mutation-killing tests for the small pure helpers behind the binary and the stdio servers.
import { describe, expect, it } from "vitest";
import { mcp } from "../src/index.ts";
import { codeFiles } from "../src/internal/codeFiles.ts";
import { createFramer } from "../src/internal/createFramer.ts";
import { frameLsp } from "../src/internal/frameLsp.ts";
import { kernelFormatters } from "../src/internal/kernelFormatters.ts";
import { mcpCall } from "../src/internal/mcpCall.ts";
import { mcpHandle } from "../src/internal/mcpHandle.ts";
import { projectFiles } from "../src/internal/projectFiles.ts";
import { readRpc } from "../src/internal/readRpc.ts";
import { scaffoldInput } from "../src/internal/scaffoldInput.ts";
import { serveStream } from "../src/internal/serveStream.ts";
import { sniffFormat } from "../src/internal/sniffFormat.ts";
import type { Io } from "../src/types/Io.ts";
import type { StdioServer } from "../src/types/StdioServer.ts";

const file = (path: string, source = ""): { path: string; source: string } => ({ path, source });

describe("projectFiles", () => {
  it("is empty without files", () => {
    expect(projectFiles({ cwd: "/w" })).toEqual([]);
  });

  it("makes paths project-relative and sorts by path; equal paths keep their input order", () => {
    const out = projectFiles({
      cwd: "/w",
      files: [
        file("/w/b.ts", "b"),
        file("a/x.ts", "ax"),
        file("./a.ts", "first"),
        file("ab.ts", "ab"),
        file("a.ts", "second"),
        file("B.ts", "upper"),
      ],
    });
    expect(out).toEqual([
      file("B.ts", "upper"),
      file("a.ts", "first"),
      file("a.ts", "second"),
      file("a/x.ts", "ax"),
      file("ab.ts", "ab"),
      file("b.ts", "b"),
    ]);
  });

  it("orders any pair, whichever way round it arrives", () => {
    const a = file("a.ts", "1");
    const b = file("b.ts", "2");
    expect(projectFiles({ cwd: "/w", files: [a, b] })).toEqual([a, b]);
    expect(projectFiles({ cwd: "/w", files: [b, a] })).toEqual([a, b]);
    expect(projectFiles({ cwd: "/w", files: [b, a, b, a] })).toEqual([a, a, b, b]);
  });
});

describe("codeFiles", () => {
  const io: Io = {
    cwd: "/w",
    files: [
      file("src/a.ts"),
      file("src/sub/b.tsx"),
      file("srcx/c.ts"),
      file("src.ts"),
      file("lib/d.js"),
      file("README.md"),
      file("/w/other/e.mjs"),
    ],
  };
  const names = (paths: readonly string[] | undefined): string[] => codeFiles(io, paths).map((f) => f.path);
  const all = ["lib/d.js", "other/e.mjs", "src.ts", "src/a.ts", "src/sub/b.tsx", "srcx/c.ts"];

  it("without paths, or with empty, blank or dot paths, every code file in order", () => {
    expect(names(undefined)).toEqual(all);
    expect(names([])).toEqual(all);
    expect(names([""])).toEqual(all);
    expect(names(["."])).toEqual(all);
    expect(names(["", ".", "./"])).toEqual(all);
  });

  it("restricts to a directory by whole path segments, with trailing slashes ignored", () => {
    const src = ["src/a.ts", "src/sub/b.tsx"];
    expect(names(["src"])).toEqual(src);
    expect(names(["src/"])).toEqual(src);
    expect(names(["src//"])).toEqual(src);
    expect(names(["./src"])).toEqual(src);
    expect(names(["/w/src"])).toEqual(src);
    expect(names(["src/sub"])).toEqual(["src/sub/b.tsx"]);
  });

  it("a file path selects exactly that file, and several roots union", () => {
    expect(names(["src/a.ts"])).toEqual(["src/a.ts"]);
    expect(names(["src.ts", "lib"])).toEqual(["lib/d.js", "src.ts"]);
    expect(names(["", "lib"])).toEqual(["lib/d.js"]);
    expect(names(["nope"])).toEqual([]);
    expect(names(["a.ts"])).toEqual([]);
    expect(names(["sub"])).toEqual([]);
  });

  it("keeps sources and drops non-code files", () => {
    const out = codeFiles({ cwd: "/w", files: [file("a.ts", "A"), file("a.md", "M")] }, undefined);
    expect(out).toEqual([file("a.ts", "A")]);
  });
});

describe("scaffoldInput", () => {
  it("maps each operation's positional and flag input, leaving missing values absent", () => {
    expect(scaffoldInput("project", { args: ["demo"], adapter: "node", workspace: true })).toEqual({
      name: "demo",
      adapter: "node",
      workspace: true,
    });
    expect(scaffoldInput("project", {})).toEqual({});
    expect(scaffoldInput("module", { args: ["m", "extra"] })).toEqual({ id: "m" });
    expect(scaffoldInput("component", { args: ["c"] })).toEqual({ id: "c" });
    expect(scaffoldInput("store", { args: ["s"] })).toEqual({ id: "s" });
    expect(scaffoldInput("store", {})).toEqual({});
    expect(scaffoldInput("route", { args: ["r"], path: "/x", file: "f.ts" })).toEqual({
      id: "r",
      path: "/x",
      file: "f.ts",
    });
    expect(scaffoldInput("route", { args: ["r"] })).toEqual({ id: "r" });
    expect(scaffoldInput("rename", { kind: "store", args: ["a", "b", "c"] })).toEqual({
      kind: "store",
      from: "a",
      to: "b",
    });
    expect(scaffoldInput("move", { args: ["n"], to: "m2" })).toEqual({ name: "n", to: "m2" });
    expect(scaffoldInput("move", { args: ["n", "ignored"] })).toEqual({ name: "n" });
  });

  it("add-field reads --default as JSON when it parses, else as a string, and omits it when absent", () => {
    const base = { args: ["User", "age", "int"] };
    expect(scaffoldInput("add-field", base)).toEqual({ schema: "User", field: "age", type: "int" });
    expect("default" in scaffoldInput("add-field", base)).toBe(false);
    expect(scaffoldInput("add-field", { ...base, default: "5" })).toEqual({
      schema: "User",
      field: "age",
      type: "int",
      default: 5,
    });
    expect(scaffoldInput("add-field", { ...base, default: '"x"' }).default).toBe("x");
    expect(scaffoldInput("add-field", { ...base, default: "abc" }).default).toBe("abc");
    expect(scaffoldInput("add-field", { ...base, default: "null" }).default).toBeNull();
    expect(scaffoldInput("add-field", { ...base, default: "[1,2]" }).default).toEqual([1, 2]);
    expect(scaffoldInput("add-field", { ...base, default: "" }).default).toBe("");
  });
});

describe("sniffFormat", () => {
  it("reads valid --format=value and --format value, whichever mode", () => {
    expect(sniffFormat(["check", "--format=json"])).toBe("json");
    expect(sniffFormat(["--format=compact"])).toBe("compact");
    expect(sniffFormat(["--format=pretty", "x"])).toBe("pretty");
    expect(sniffFormat(["check", "--format", "pretty"])).toBe("pretty");
    expect(sniffFormat(["--format", "compact"])).toBe("compact");
  });

  it("the value is the argument after the flag, not before it", () => {
    expect(sniffFormat(["json", "--format", "pretty"])).toBe("pretty");
    expect(sniffFormat(["pretty", "--format", "bogus"])).toBeUndefined();
  });

  it("an invalid, empty or missing value is undefined, and the first --format decides", () => {
    expect(sniffFormat(["--format=bogus"])).toBeUndefined();
    expect(sniffFormat(["--format="])).toBeUndefined();
    expect(sniffFormat(["--format"])).toBeUndefined();
    expect(sniffFormat(["--format", "bogus"])).toBeUndefined();
    expect(sniffFormat(["--format=bogus", "--format=json"])).toBeUndefined();
    expect(sniffFormat(["--format", "bogus", "--format=json"])).toBeUndefined();
    expect(sniffFormat(["--format=json", "--format=pretty"])).toBe("json");
  });

  it("ignores everything else", () => {
    expect(sniffFormat([])).toBeUndefined();
    expect(sniffFormat(["check", "--formatx=json", "json", "-format=json"])).toBeUndefined();
  });
});

describe("readRpc", () => {
  it("classifies requests, notifications and ids", () => {
    expect(readRpc('{"jsonrpc":"2.0","id":1,"method":"ping","params":{"a":1}}')).toEqual({
      kind: "request",
      id: 1,
      method: "ping",
      params: { a: 1 },
    });
    expect(readRpc('{"jsonrpc":"2.0","id":"s","method":"m"}')).toEqual({
      kind: "request",
      id: "s",
      method: "m",
      params: undefined,
    });
    expect(readRpc('{"jsonrpc":"2.0","id":null,"method":"m"}')).toEqual({
      kind: "request",
      id: null,
      method: "m",
      params: undefined,
    });
    expect(readRpc('{"jsonrpc":"2.0","method":"note","params":[1]}')).toEqual({
      kind: "notification",
      method: "note",
      params: [1],
    });
  });

  it("text that is not JSON is unparsable", () => {
    expect(readRpc("{nope")).toEqual({ kind: "unparsable" });
    expect(readRpc("")).toEqual({ kind: "unparsable" });
  });

  it("invalid messages carry the id when one could be read, with the exact reason", () => {
    expect(readRpc("[]")).toEqual({ kind: "invalid", id: null, message: "batch requests are not supported" });
    for (const t of ["5", '"s"', "null", "true"])
      expect(readRpc(t)).toEqual({ kind: "invalid", id: null, message: "a message must be a JSON object" });
    for (const idJson of ["true", "{}", "[1]"])
      expect(readRpc(`{"jsonrpc":"2.0","id":${idJson},"method":"m"}`)).toEqual({
        kind: "invalid",
        id: null,
        message: "id must be a string, number or null",
      });
    expect(readRpc('{"jsonrpc":"1.0","id":5,"method":"m"}')).toEqual({
      kind: "invalid",
      id: 5,
      message: 'jsonrpc must be "2.0"',
    });
    expect(readRpc('{"id":"x","method":"m"}')).toEqual({ kind: "invalid", id: "x", message: 'jsonrpc must be "2.0"' });
    expect(readRpc('{"method":"m"}')).toEqual({ kind: "invalid", id: null, message: 'jsonrpc must be "2.0"' });
    expect(readRpc('{"jsonrpc":"2.0","id":null}')).toEqual({
      kind: "invalid",
      id: null,
      message: "not a request: no method",
    });
    expect(readRpc('{"jsonrpc":"2.0","id":7,"result":{}}')).toEqual({
      kind: "invalid",
      id: 7,
      message: "not a request: no method",
    });
    expect(readRpc('{"jsonrpc":"2.0","id":7,"method":5}')).toEqual({
      kind: "invalid",
      id: 7,
      message: "not a request: no method",
    });
    expect(readRpc('{"jsonrpc":"2.0","method":null}')).toEqual({
      kind: "invalid",
      id: null,
      message: "not a request: no method",
    });
  });
});

describe("createFramer", () => {
  const f = (body: string): string => `Content-Length: ${new TextEncoder().encode(body).length}\r\n\r\n${body}`;

  it("emits a frame only once its whole body has arrived, byte by byte", () => {
    const fr = createFramer();
    const text = f('{"a":1}');
    const got = [...text].flatMap((ch) => fr.push(ch));
    expect(got).toEqual([{ body: '{"a":1}' }]);
  });

  it("a frame one byte short waits; the last byte releases it", () => {
    const fr = createFramer();
    const text = f("abcd");
    expect(fr.push(text.slice(0, -1))).toEqual([]);
    expect(fr.push(text.slice(-1))).toEqual([{ body: "abcd" }]);
    expect(fr.push("")).toEqual([]);
  });

  it("several frames in one chunk, leaving a trailing partial for the next", () => {
    const fr = createFramer();
    const text = f("one") + f("two") + f("three");
    expect(fr.push(text.slice(0, -2))).toEqual([{ body: "one" }, { body: "two" }]);
    expect(fr.push(text.slice(-2))).toEqual([{ body: "three" }]);
  });

  it("accepts byte chunks, counts length in bytes, and decodes multi-byte text", () => {
    const fr = createFramer();
    const bytes = new TextEncoder().encode(f("héllo ✓"));
    expect(fr.push(bytes.subarray(0, 25))).toEqual([]);
    expect(fr.push(bytes.subarray(25))).toEqual([{ body: "héllo ✓" }]);
  });

  it("reads Content-Length case-insensitively, among other headers, with any spacing", () => {
    const fr = createFramer();
    expect(fr.push("content-length:3\r\n\r\nabc")).toEqual([{ body: "abc" }]);
    expect(fr.push("Content-Type: x\r\nCONTENT-LENGTH:   2\r\n\r\nhi")).toEqual([{ body: "hi" }]);
    expect(fr.push("Content-Length:\t4\r\n\r\nwxyz")).toEqual([{ body: "wxyz" }]);
  });

  it("a zero-length body is a frame", () => {
    expect(createFramer().push("Content-Length: 0\r\n\r\n")).toEqual([{ body: "" }]);
  });

  it("a header block without Content-Length is skipped as an error frame, and framing continues", () => {
    const fr = createFramer();
    const out = fr.push(`X-Other: 1\r\n\r\n${f("ok")}`);
    expect(out).toEqual([{ error: 'malformed header: "X-Other: 1" has no Content-Length' }, { body: "ok" }]);
    const long = "H".repeat(100);
    expect(fr.push(`${long}\r\n\r\n`)).toEqual([
      { error: `malformed header: ${JSON.stringify("H".repeat(60))} has no Content-Length` },
    ]);
    expect(fr.push("Content-Length: abc\r\n\r\n")).toEqual([
      { error: 'malformed header: "Content-Length: abc" has no Content-Length' },
    ]);
  });

  it("an empty header block (separator at the very start) is an error frame too", () => {
    const fr = createFramer();
    expect(fr.push(`\r\n\r\n${f("z")}`)).toEqual([
      { error: 'malformed header: "" has no Content-Length' },
      { body: "z" },
    ]);
  });

  it("interoperates with frameLsp", () => {
    expect(createFramer().push(frameLsp({ a: "é" }))).toEqual([{ body: '{"a":"é"}' }]);
  });
});

describe("mcp server framing", () => {
  const ping = (id: number): string => `{"jsonrpc":"2.0","id":${id},"method":"ping"}`;

  it("never reports done", () => {
    expect(mcp(() => ({ cwd: "/w" })).done()).toBe(false);
  });

  it("holds a partial line until its newline arrives, skips blank lines, replies per line", async () => {
    const s = mcp(() => ({ cwd: "/w" }));
    expect(await s.receive(ping(1).slice(0, 10))).toBe("");
    expect(await s.receive(`${ping(1).slice(10)}\n\n   \n${ping(2)}`)).toBe('{"jsonrpc":"2.0","id":1,"result":{}}\n');
    expect(await s.receive("\n")).toBe('{"jsonrpc":"2.0","id":2,"result":{}}\n');
  });

  it("a whitespace-only line is ignored rather than answered with a parse error", async () => {
    expect(await mcp(() => ({ cwd: "/w" })).receive("  \t \n")).toBe("");
  });

  it("notifications produce no output", async () => {
    expect(await mcp(() => ({ cwd: "/w" })).receive('{"jsonrpc":"2.0","method":"notifications/initialized"}\n')).toBe(
      "",
    );
  });

  it("decodes byte chunks, including a character split across chunks", async () => {
    const line = new TextEncoder().encode(`${JSON.stringify({ jsonrpc: "2.0", id: "é", method: "ping" })}\n`);
    const cut = line.indexOf(0xc3) + 1;
    const s = mcp(() => ({ cwd: "/w" }));
    expect(await s.receive(line.subarray(0, cut))).toBe("");
    expect(await s.receive(line.subarray(cut))).toBe('{"jsonrpc":"2.0","id":"é","result":{}}\n');
  });

  it("calls provide per tool call, not per message", async () => {
    let calls = 0;
    const s = mcp(() => {
      calls++;
      return { cwd: "/w" };
    });
    await s.receive(`${ping(1)}\n`);
    expect(calls).toBe(0);
    const call = (id: number): string =>
      JSON.stringify({ jsonrpc: "2.0", id, method: "tools/call", params: { name: "explain", arguments: {} } });
    await s.receive(`${call(2)}\n${call(3)}\n`);
    expect(calls).toBe(2);
  });
});

describe("mcpHandle", () => {
  const io: Io = { cwd: "/w", files: [file("src/x.ts", "export const x = 1;\n")], tty: true };
  const h = (line: string, provide: () => Io = () => io) => mcpHandle(line, provide);

  it("initialize echoes a string protocolVersion, else the default, and describes the server", async () => {
    const caps = { tools: { listChanged: false } };
    const info = { name: "keel", version: "0.0.0" };
    const want = (v: string) => ({
      jsonrpc: "2.0",
      id: 1,
      result: { protocolVersion: v, capabilities: caps, serverInfo: info },
    });
    expect(await h('{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"1999-01-01"}}')).toEqual(
      want("1999-01-01"),
    );
    expect(await h('{"jsonrpc":"2.0","id":1,"method":"initialize"}')).toEqual(want("2025-06-18"));
    expect(await h('{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":5}}')).toEqual(
      want("2025-06-18"),
    );
    expect(await h('{"jsonrpc":"2.0","id":1,"method":"initialize","params":[]}')).toEqual(want("2025-06-18"));
    expect(await h('{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":""}}')).toEqual(want(""));
  });

  it("ping, unknown methods and notifications", async () => {
    expect(await h('{"jsonrpc":"2.0","id":3,"method":"ping"}')).toEqual({ jsonrpc: "2.0", id: 3, result: {} });
    expect(await h('{"jsonrpc":"2.0","id":4,"method":"nope"}')).toEqual({
      jsonrpc: "2.0",
      id: 4,
      error: { code: -32601, message: "method not found: nope" },
    });
    expect(await h('{"jsonrpc":"2.0","method":"ping"}')).toBeUndefined();
    expect(await h('{"jsonrpc":"2.0","method":"nope"}')).toBeUndefined();
  });

  it("protocol failures are answered, not thrown", async () => {
    expect(await h("{")).toEqual({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } });
    expect(await h("[]")).toEqual({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32600, message: "batch requests are not supported" },
    });
  });

  it("a throw while serving a request is -32603 with the first line of the message, for that request only", async () => {
    const r = await h('{"jsonrpc":"2.0","id":9,"method":"tools/call","params":{"name":"check"}}', () => {
      throw new Error("boom\nsecond line");
    });
    expect(r).toEqual({ jsonrpc: "2.0", id: 9, error: { code: -32603, message: "internal error: boom" } });
    expect(await h('{"jsonrpc":"2.0","id":10,"method":"ping"}')).toEqual({ jsonrpc: "2.0", id: 10, result: {} });
  });

  it("tools/list lists one tool per operation", async () => {
    const r = await h('{"jsonrpc":"2.0","id":1,"method":"tools/list"}');
    const result: unknown = r?.result;
    const tools: unknown[] =
      typeof result === "object" && result !== null && "tools" in result && Array.isArray(result.tools)
        ? result.tools
        : [];
    const names = tools.map((t) => (typeof t === "object" && t !== null && "name" in t ? t.name : undefined));
    expect(names).toContain("check");
    expect(tools.length).toBeGreaterThan(5);
  });
});

describe("mcpCall", () => {
  const io: Io = { cwd: "/w", files: [file("src/x.ts", "export const x = 1;\n")], tty: true };

  it("an unknown or missing tool name is E1051 with the name cut to 24 characters", async () => {
    const r = await mcpCall({ name: "z".repeat(40) }, io);
    expect(r.isError).toBe(true);
    expect(r.content).toEqual([
      {
        type: "text",
        text: `E1051 unknown command "${"z".repeat(24)}"\n  see: keel docs k.cli\nfail ${"z".repeat(40)} 1 errors\n`,
      },
    ]);
    expect(r.structuredContent.records[0]).toEqual({
      kind: "diag",
      code: "E1051",
      message: `unknown command "${"z".repeat(24)}"`,
      see: "k.cli",
    });
    for (const params of [undefined, null, 5, {}, { name: 5 }, []]) {
      const e = await mcpCall(params, io);
      expect(e.isError).toBe(true);
      expect(e.content[0]?.text).toBe('E1051 unknown command ""\n  see: keel docs k.cli\nfail 1 errors\n');
    }
  });

  it("a known tool runs compact even when the host is a tty, and mirrors the records", async () => {
    const r = await mcpCall({ name: "check", arguments: {} }, io);
    expect(r).toEqual({
      content: [{ type: "text", text: "ok check 1 files, 0 errors, 0 warnings\n" }],
      structuredContent: {
        records: [
          {
            kind: "summary",
            ok: true,
            name: "check",
            counts: { files: 1, refreshed: 0, errors: 0, warnings: 0, evaluated: 0, cached: 0 },
          },
        ],
      },
      isError: false,
    });
  });

  it("an explicit format wins; failures set isError", async () => {
    const pretty = await mcpCall({ name: "check", arguments: { format: "pretty" } }, io);
    expect(pretty.content[0]?.text).toBe("check: passed (1 files, 0 errors, 0 warnings)\n");
    const bad = await mcpCall({ name: "check", arguments: { bogus: 1 } }, io);
    expect(bad.isError).toBe(true);
    expect(bad.content[0]?.text).toBe('E1052 unknown argument "bogus"\n  see: keel docs k.cli\nfail check 1 errors\n');
    const missingArgs = await mcpCall({ name: "check" }, io);
    expect(missingArgs.isError).toBe(false);
  });
});

describe("serveStream", () => {
  async function* gen(...parts: (string | Uint8Array)[]): AsyncIterable<string | Uint8Array> {
    for (const p of parts) yield p;
  }
  const fake = (
    reply: (chunk: string | Uint8Array, n: number) => string | Error,
    doneAfter = Number.POSITIVE_INFINITY,
  ): { server: StdioServer; seen: (string | Uint8Array)[] } => {
    const seen: (string | Uint8Array)[] = [];
    return {
      seen,
      server: {
        receive: async (c) => {
          seen.push(c);
          const r = reply(c, seen.length);
          if (r instanceof Error) throw r;
          return r;
        },
        done: () => seen.length >= doneAfter,
      },
    };
  };

  it("emits each non-empty reply as it comes and nothing for empty ones", async () => {
    const emitted: string[] = [];
    const { server, seen } = fake((c) => (c === "b" ? "" : `r:${String(c)}`));
    await serveStream(server, "lsp", gen("a", "b", "c"), (t) => emitted.push(t));
    expect(emitted).toEqual(["r:a", "r:c"]);
    expect(seen).toEqual(["a", "b", "c"]);
  });

  it("at the end of input an mcp server gets a final newline, and its tail is emitted when non-empty", async () => {
    const emitted: string[] = [];
    const { server, seen } = fake((c) => (c === "\n" ? "tail" : ""));
    await serveStream(server, "mcp", gen("a"), (t) => emitted.push(t));
    expect(seen).toEqual(["a", "\n"]);
    expect(emitted).toEqual(["tail"]);

    const none: string[] = [];
    const f2 = fake(() => "");
    await serveStream(f2.server, "mcp", gen("a"), (t) => none.push(t));
    expect(f2.seen).toEqual(["a", "\n"]);
    expect(none).toEqual([]);
  });

  it("an lsp stream gets no final flush", async () => {
    const emitted: string[] = [];
    const { server, seen } = fake(() => "x");
    await serveStream(server, "lsp", gen("a"), (t) => emitted.push(t));
    expect(seen).toEqual(["a"]);
    expect(emitted).toEqual(["x"]);
  });

  it("stops reading as soon as the server is done, with no final flush", async () => {
    const emitted: string[] = [];
    const { server, seen } = fake(() => "x", 2);
    await serveStream(server, "mcp", gen("a", "b", "c", "d"), (t) => emitted.push(t));
    expect(seen).toEqual(["a", "b"]);
    expect(emitted).toEqual(["x", "x"]);
  });

  it("a throw is answered with -32603 in the protocol's framing and serving continues", async () => {
    const reply = { jsonrpc: "2.0", id: null, error: { code: -32603, message: "internal error: kaput" } };
    const m: string[] = [];
    const a = fake((_c, n) => (n === 1 ? new Error("kaput\nmore") : "next"));
    await serveStream(a.server, "mcp", gen("a", "b"), (t) => m.push(t));
    expect(m).toEqual([`${JSON.stringify(reply)}\n`, "next", "next"]);

    const l: string[] = [];
    const b = fake((_c, n) => (n === 1 ? new Error("kaput\nmore") : "next"));
    await serveStream(b.server, "lsp", gen("a", "b"), (t) => l.push(t));
    expect(l).toEqual([frameLsp(reply), "next"]);
  });

  it("a thrown non-Error is stringified", async () => {
    const m: string[] = [];
    const server: StdioServer = {
      receive: () => Promise.reject("plain"),
      done: () => false,
    };
    await serveStream(server, "lsp", gen("a"), (t) => m.push(t));
    expect(m).toEqual([
      frameLsp({ jsonrpc: "2.0", id: null, error: { code: -32603, message: "internal error: plain" } }),
    ]);
  });
});

describe("kernelFormatters", () => {
  const render = (kind: string, mode: "compact" | "json" | "pretty", record: unknown): string | undefined =>
    kernelFormatters.find(([k]) => k === kind)?.[1].render(mode, record);
  const all = (kind: string, record: unknown): [string | undefined, string | undefined] => [
    render(kind, "compact", record),
    render(kind, "pretty", record),
  ];

  it("renders a review finding, and a review trailer says listed", () => {
    const f = {
      kind: "review",
      code: "R1053",
      path: "modules/a/x.ts",
      line: 4,
      col: 9,
      message: "module specifier computed at run time",
      protection: "k.security",
      opt: false,
      danger: "critical",
      novelty: "new",
      loud: "fail",
      id: "3f2a9c01d2e4",
    };
    expect(render("review", "compact", f)).toBe(
      "R1053 modules/a/x.ts:4:9 critical new module specifier computed at run time",
    );
    expect(render("review", "pretty", { ...f, opt: true, reason: "r" })).toContain("opt-in");
    const counts = { fail: 0, warn: 2, list: 14, accepted: 3 };
    expect(render("summary", "compact", { kind: "summary", ok: true, name: "review", counts })).toBe(
      "ok review 0 fail, 2 warn, 14 listed, 3 accepted",
    );
    expect(render("summary", "compact", { kind: "summary", ok: true, name: "x", counts: { list: 1 } })).toBe(
      "ok x 1 list",
    );
  });

  it("registers the kernel and cli record kinds in order", () => {
    expect(kernelFormatters.map(([k]) => k)).toEqual([
      "diag",
      "summary",
      "req",
      "review",
      "ledger",
      "ledger.mutation",
      "evidence",
      "a11y",
      "docs.entry",
      "docs.area",
      "docs.code",
      "docs.term",
      "docs.hit",
      "docs.section",
      "docs.skill",
      "docs.cite",
      "explain.text",
      "inspect.store",
      "inspect.section",
      "scaffold.edit",
    ]);
  });

  it("ledger.mutation: compact `<file> <score>% <n> survived`, one decimal, `stale` when not fresh", () => {
    const r = { kind: "ledger.mutation", file: "packages/store/src/tx.ts", score: 91.25, survived: 3, fresh: true };
    expect(all("ledger.mutation", r)).toEqual([
      "packages/store/src/tx.ts 91.3% 3 survived",
      "packages/store/src/tx.ts: 91.3% (3 survived)",
    ]);
    expect(render("ledger.mutation", "compact", { ...r, fresh: false })).toBe(
      "packages/store/src/tx.ts 91.3% 3 survived stale",
    );
  });

  it("inspect.section: compact and pretty clip the value's JSON at 120 chars", () => {
    const rec = { kind: "inspect.section", id: "orders.recent", doc: "{ n: int }", value: { n: 1 } };
    expect(all("inspect.section", rec)).toEqual([
      'section orders.recent {"n":1}',
      'section orders.recent: { n: int }\n  {"n":1}',
    ]);
    const long = render("inspect.section", "compact", { ...rec, value: "x".repeat(200) }) ?? "";
    expect(long).toBe(`section orders.recent "${"x".repeat(116)}...`);
    expect(render("inspect.section", "json", rec)).toBe(JSON.stringify(rec));
  });

  it("a record that does not fit its schema renders as undefined in every mode", () => {
    for (const [k] of kernelFormatters)
      for (const mode of ["compact", "json", "pretty"] as const)
        expect(render(k, mode, { kind: "nope" })).toBeUndefined();
  });

  it("summary", () => {
    const ok = { kind: "summary", ok: true, name: "check", counts: { files: 2, errors: 0 } };
    expect(all("summary", ok)).toEqual(["ok check 2 files, 0 errors", "check: passed (2 files, 0 errors)"]);
    expect(all("summary", { ...ok, ok: false })).toEqual([
      "fail check 2 files, 0 errors",
      "check: failed (2 files, 0 errors)",
    ]);
    expect(all("summary", { ...ok, counts: {} })).toEqual(["ok check", "check: passed"]);
    expect(render("summary", "json", ok)).toBe(
      '{"kind":"summary","ok":true,"name":"check","counts":{"files":2,"errors":0}}',
    );
  });

  it("req", () => {
    const r = { kind: "req", method: "GET", path: "/orders/7", route: "orders.show", status: 200, ms: 12 };
    expect(all("req", r)).toEqual(["GET /orders/7 orders.show 200 12ms", "200 GET /orders/7  (orders.show)  12ms"]);
    const { route: _route, ...bare } = r;
    expect(all("req", bare)).toEqual(["GET /orders/7 200 12ms", "200 GET /orders/7  12ms"]);
  });

  it("ledger", () => {
    const r = { kind: "ledger", item: "k.cli", rung: "example", evidence: "test/a.ts" };
    expect(all("ledger", r)).toEqual(["k.cli example test/a.ts", "example       k.cli\n  evidence: test/a.ts"]);
    expect(render("ledger", "pretty", { ...r, rung: "none" })).toBe("none          k.cli\n  evidence: test/a.ts");
  });

  it("a11y: indentation by depth and the set state flags only", () => {
    const n = {
      kind: "a11y",
      id: "b1",
      role: "button",
      name: "Save",
      depth: 2,
      state: { checked: false, disabled: true, focused: true },
    };
    expect(all("a11y", n)).toEqual([
      '    button "Save" b1 [disabled focused]',
      '    - button "Save" (#b1) [disabled focused]',
    ]);
    const plain = { ...n, depth: 0, state: {} };
    expect(all("a11y", plain)).toEqual(['button "Save" b1', '- button "Save" (#b1)']);
    expect(all("a11y", { ...plain, depth: 1, state: { checked: false } })).toEqual([
      '  button "Save" b1',
      '  - button "Save" (#b1)',
    ]);
    expect(render("a11y", "compact", { ...plain, state: { checked: true } })).toBe('button "Save" b1 [checked]');
    expect(
      render("a11y", "compact", { ...plain, state: { checked: true, expanded: true, selected: true, invalid: true } }),
    ).toBe('button "Save" b1 [checked expanded selected invalid]');
  });

  it("docs.section and docs.skill are the text with one final newline dropped", () => {
    const r = { kind: "docs.section", id: "k.cli", text: "  ## Title\n\nbody  \n\n" };
    expect(all("docs.section", r)).toEqual(["  ## Title\n\nbody  \n", "  ## Title\n\nbody  \n"]);
    expect(all("docs.skill", { kind: "docs.skill", id: "s", text: "x" })).toEqual(["x", "x"]);
  });

  it("docs.entry: ` not installed` when the package is absent, `: <holds>` when it holds text", () => {
    const r = {
      kind: "docs.entry",
      id: "k.router",
      title: "Routes",
      package: "@keel/router",
      installed: true,
      holds: "",
    };
    expect(all("docs.entry", r)).toEqual(["k.router Routes @keel/router", "k.router         Routes (@keel/router)"]);
    expect(all("docs.entry", { ...r, installed: false })).toEqual([
      "k.router Routes @keel/router not installed",
      "k.router         Routes (@keel/router, not installed)",
    ]);
    expect(all("docs.entry", { ...r, installed: false, holds: "the table" })).toEqual([
      "k.router Routes @keel/router not installed: the table",
      "k.router         Routes (@keel/router, not installed)\n  the table",
    ]);
  });

  it("docs.area, docs.code, docs.term and docs.hit", () => {
    const area = { kind: "docs.area", id: "data", title: "Durable storage", sections: 6 };
    expect(all("docs.area", area)).toEqual([
      "data Durable storage, 6 sections",
      "data       Durable storage (6 sections)",
    ]);
    expect(all("docs.area", { ...area, sections: 1 })[0]).toBe("data Durable storage, 1 section");
    const code = { kind: "docs.code", code: "E1551", ids: ["k.a", "k.b", "k.c", "k.d", "k.e"] };
    expect(all("docs.code", code)).toEqual(["E1551 k.a k.b k.c +2", "E1551: k.a, k.b, k.c, k.d, k.e"]);
    expect(all("docs.code", { ...code, ids: ["k.a"] })[0]).toBe("E1551 k.a");
    const term = { kind: "docs.term", term: "identity mount", text: "the path", ids: ["k.mount"] };
    expect(all("docs.term", term)).toEqual(["identity mount: the path", "identity mount\n  the path"]);
    const hit = { kind: "docs.hit", name: "x", id: "k.testing", title: "Harness", package: "@keel/testing", count: 2 };
    expect(all("docs.hit", hit)).toEqual(["k.testing Harness 2", "k.testing        Harness (2 spans)"]);
    expect(all("docs.hit", { ...hit, count: 1 })[1]).toBe("k.testing        Harness (1 span)");
  });

  it("docs.cite", () => {
    const r = { kind: "docs.cite", code: "E1", id: "k.a", line: 12, text: "cites E1" };
    expect(all("docs.cite", r)).toEqual(["k.a:12 cites E1", "k.a:12\n  cites E1"]);
  });

  it("explain.text prefixes the code unless the text already names it", () => {
    const r = { kind: "explain.text", code: "E1051", text: "unknown command" };
    expect(all("explain.text", r)).toEqual(["E1051 unknown command", "E1051\n\nunknown command"]);
    expect(render("explain.text", "compact", { ...r, text: "see E1051 here" })).toBe("see E1051 here");
  });

  it("inspect.store", () => {
    const r = { kind: "inspect.store", id: "cart", entries: 3, last: "add" };
    expect(all("inspect.store", r)).toEqual(["cart 3 entries, last add", "store cart: 3 log entries (last add)"]);
    expect(all("inspect.store", { kind: "inspect.store", id: "cart", entries: 0 })).toEqual([
      "cart 0 entries",
      "store cart: 0 log entries",
    ]);
  });

  it("scaffold.edit prefers the diff, else action and path", () => {
    const r = { kind: "scaffold.edit", action: "create", path: "a.ts" };
    expect(all("scaffold.edit", r)).toEqual(["create a.ts", "create a.ts"]);
    expect(all("scaffold.edit", { ...r, diff: "+x" })).toEqual(["+x", "create a.ts\n+x"]);
    expect(all("scaffold.edit", { ...r, action: "remove" })).toEqual(["remove a.ts", "remove a.ts"]);
  });
});
