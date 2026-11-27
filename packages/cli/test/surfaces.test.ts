// One engine, three surfaces (k.cli): the binary engine `run`, the MCP server and the LSP server agree. Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { lsp, mcp, operations, run } from "../src/index.ts";
import { SHARED_FLAGS } from "../src/internal/SHARED_FLAGS.ts";
import { toJsonSchema } from "../src/internal/toJsonSchema.ts";
import type { Io } from "../src/types/Io.ts";
import { applyEdits } from "./support/applyEdits.ts";

const SEED = 1337;
const CWD = "/work/app";
const clean = (n: number) => ({ path: `src/Ok${n}.ts`, source: `export const Ok${n} = ${n}\n` });
const dirty = (n: number) => ({
  path: `src/Bad${n}.ts`,
  source: `export const Bad${n} = ${n}\nexport const Extra${n} = ${n}\n`,
});
const project = (n: number) => [clean(1), ...Array.from({ length: n }, (_, i) => dirty(i))];

const rpc = (id: number, method: string, params: unknown) => JSON.stringify({ jsonrpc: "2.0", id, method, params });
const replies = (out: string): Record<string, unknown>[] =>
  out
    .split("\n")
    .filter((l) => l !== "")
    .map((l) => JSON.parse(l));
const frame = (m: unknown): string => {
  const body = JSON.stringify(m);
  return `Content-Length: ${new TextEncoder().encode(body).length}\r\n\r\n${body}`;
};
const unframe = (out: string): Record<string, unknown>[] =>
  out
    .split(/Content-Length: \d+\r\n\r\n/)
    .filter((b) => b !== "")
    .map((b) => JSON.parse(b));
type Key = string;
const key = (d: { code: unknown; path?: unknown; line?: unknown; col?: unknown; message: unknown }): Key =>
  JSON.stringify([d.code, d.path, d.line, d.col, d.message]);

describe("surfaces", () => {
  it("each MCP tool's input schema equals the JSON Schema of its operation's input less the shared flags, which initialize states once", async () => {
    const out = await mcp(() => ({ cwd: CWD })).receive(`${rpc(1, "tools/list", {})}\n`);
    const [reply] = replies(out);
    const result = reply?.result;
    const tools: { name: string; inputSchema: unknown }[] =
      typeof result === "object" && result !== null && "tools" in result && Array.isArray(result.tools)
        ? result.tools
        : [];
    expect(tools.map((t) => t.name)).toEqual(operations.map((o) => o.name));
    for (const op of operations) {
      const full = toJsonSchema(op.input.node);
      const props = typeof full.properties === "object" && full.properties !== null ? full.properties : {};
      const own = Object.fromEntries(Object.entries(props).filter(([k]) => !SHARED_FLAGS.names.includes(k)));
      expect(Object.keys(props)).toEqual(expect.arrayContaining([...SHARED_FLAGS.names]));
      expect(tools.find((t) => t.name === op.name)?.inputSchema).toEqual({ ...full, properties: own });
    }
    const [init] = replies(await mcp(() => ({ cwd: CWD })).receive(`${rpc(2, "initialize", {})}\n`));
    const text = JSON.stringify(init?.result);
    for (const flag of SHARED_FLAGS.names) expect(text).toContain(flag);
  });

  it("check --format=json, the MCP check tool, and LSP diagnostics yield the same set of (code, path, line, col, message)", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 6 }), async (n) => {
        const files = project(n);
        const io: Io = { cwd: CWD, files, env: {}, tty: false };
        const cli = (await run(["check", "--format=json"], io)).stdout;
        const fromCli = new Set(
          replies(cli)
            .filter((r) => r.kind === "diag")
            .map((d) => key({ code: d.code, path: d.path, line: d.line, col: d.col, message: d.message })),
        );

        const mcpOut = await mcp(() => io).receive(
          `${rpc(1, "tools/call", { name: "check", arguments: { format: "json" } })}\n`,
        );
        const call = replies(mcpOut)[0]?.result;
        const text =
          typeof call === "object" && call !== null && "content" in call && Array.isArray(call.content)
            ? String(call.content[0]?.text)
            : "";
        expect(text).toBe(cli);

        const server = lsp(() => ({ cwd: CWD, files: [], env: {} }));
        let lspOut = await server.receive(
          frame({ jsonrpc: "2.0", id: 1, method: "initialize", params: { rootUri: `file://${CWD}` } }),
        );
        for (const f of files)
          lspOut += await server.receive(
            frame({
              jsonrpc: "2.0",
              method: "textDocument/didOpen",
              params: {
                textDocument: { uri: `file://${CWD}/${f.path}`, languageId: "typescript", version: 1, text: f.source },
              },
            }),
          );
        const latest = new Map<string, { code: unknown; line: number; character: number; message: unknown }[]>();
        for (const m of unframe(lspOut)) {
          if (m.method !== "textDocument/publishDiagnostics") continue;
          const p = m.params;
          if (
            typeof p !== "object" ||
            p === null ||
            !("uri" in p) ||
            !("diagnostics" in p) ||
            !Array.isArray(p.diagnostics)
          )
            continue;
          latest.set(
            String(p.uri),
            p.diagnostics.map(
              (d: { code: unknown; message: unknown; range: { start: { line: number; character: number } } }) => ({
                code: d.code,
                message: d.message,
                line: d.range.start.line,
                character: d.range.start.character,
              }),
            ),
          );
        }
        const fromLsp = new Set(
          [...latest].flatMap(([uri, ds]) =>
            ds.map((d) =>
              key({
                code: d.code,
                path: uri.slice(`file://${CWD}/`.length),
                line: d.line + 1,
                col: d.character + 1,
                message: d.message,
              }),
            ),
          ),
        );
        expect(fromLsp).toEqual(fromCli);
      }),
      { seed: SEED, numRuns: 7 },
    );
  });

  it("MCP tools/call validates arguments with the input schema: E1052, isError", async () => {
    const io: Io = { cwd: CWD, files: [] };
    const out = await mcp(() => io).receive(
      `${rpc(1, "tools/call", { name: "check", arguments: { limit: "x" } })}\n${rpc(2, "tools/call", { name: "check", arguments: { zzz: true } })}\n${rpc(3, "tools/call", { name: "nope", arguments: {} })}\n`,
    );
    const rs = replies(out).map((r) => JSON.stringify(r.result));
    expect(rs[0]).toContain("E1052");
    expect(rs[1]).toContain("E1052");
    expect(rs[2]).toContain("E1051");
    for (const r of rs) expect(r).toContain('"isError":true');
  });

  it("MCP initialize, ping, notifications and unknown methods", async () => {
    const out = await mcp(() => ({ cwd: CWD })).receive(
      [
        rpc(1, "initialize", { protocolVersion: "2025-06-18" }),
        JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
        rpc(2, "ping", {}),
        rpc(3, "nope/nope", {}),
        "{not json",
      ].join("\n"),
    );
    const rs = replies(`${out}`);
    expect(rs).toHaveLength(3);
    expect(JSON.stringify(rs[0])).toContain('"protocolVersion":"2025-06-18"');
    expect(rs[1]).toEqual({ jsonrpc: "2.0", id: 2, result: {} });
    expect(JSON.stringify(rs[2])).toContain("-32601");
  });

  it("run(['mcp']) serves stdin and returns the replies", async () => {
    const r = await run(["mcp"], { cwd: CWD, stdin: rpc(7, "ping", {}) });
    expect(replies(r.stdout)).toEqual([{ jsonrpc: "2.0", id: 7, result: {} }]);
    expect((await run(["lsp", "--help"], { cwd: CWD })).stdout).toContain("E1052");
  });

  it("LSP hover on a diagnostic line shows explain; didClose clears diagnostics; exit ends the server", async () => {
    const server = lsp(() => ({ cwd: CWD, files: [] }));
    const uri = `file://${CWD}/src/Bad0.ts`;
    await server.receive(frame({ jsonrpc: "2.0", id: 1, method: "initialize", params: { rootUri: `file://${CWD}` } }));
    const opened = await server.receive(
      frame({
        jsonrpc: "2.0",
        method: "textDocument/didOpen",
        params: { textDocument: { uri, text: dirty(0).source } },
      }),
    );
    const at = /"range":\{"start":\{"line":(\d+)/.exec(opened)?.[1];
    expect(at).toBeDefined();
    const hover = unframe(
      await server.receive(
        frame({
          jsonrpc: "2.0",
          id: 2,
          method: "textDocument/hover",
          params: { textDocument: { uri }, position: { line: Number(at), character: 0 } },
        }),
      ),
    );
    expect(JSON.stringify(hover[0])).toContain("E1752");
    const closed = unframe(
      await server.receive(
        frame({ jsonrpc: "2.0", method: "textDocument/didClose", params: { textDocument: { uri } } }),
      ),
    );
    expect(closed).toEqual([
      { jsonrpc: "2.0", method: "textDocument/publishDiagnostics", params: { uri, diagnostics: [] } },
    ]);
    await server.receive(frame({ jsonrpc: "2.0", method: "exit" }));
    expect(server.done()).toBe(true);
  });

  it("LSP code actions turn a diagnostic's fix diff into a quick fix that applies to the document", async () => {
    const server = lsp(() => ({ cwd: CWD, files: [] }));
    const uri = `file://${CWD}/src/x.ts`;
    const text = "export function x(): number {\n  throw new Error('no')\n}\n";
    await server.receive(frame({ jsonrpc: "2.0", id: 1, method: "initialize", params: { rootUri: `file://${CWD}` } }));
    await server.receive(
      frame({ jsonrpc: "2.0", method: "textDocument/didOpen", params: { textDocument: { uri, text } } }),
    );
    const out = unframe(
      await server.receive(
        frame({
          jsonrpc: "2.0",
          id: 2,
          method: "textDocument/codeAction",
          params: {
            textDocument: { uri },
            range: { start: { line: 0, character: 0 }, end: { line: 3, character: 0 } },
          },
        }),
      ),
    );
    const actions = out[0]?.result;
    expect(Array.isArray(actions) && actions.length > 0).toBe(true);
    const first: unknown = Array.isArray(actions) ? actions[0] : undefined;
    const edits =
      typeof first === "object" &&
      first !== null &&
      "edit" in first &&
      typeof first.edit === "object" &&
      first.edit !== null &&
      "changes" in first.edit
        ? Reflect.get(Object(first.edit.changes), uri)
        : undefined;
    expect(Array.isArray(edits)).toBe(true);
    const fixed = applyEdits(text, Array.isArray(edits) ? edits : []);
    expect(fixed).not.toBe(text);
    expect(fixed).not.toContain("throw new Error");
  });
});
