// k.cli "One engine": `keel mcp` and `keel lsp` serve the same engine (RFC 0020). Public API only:
// `run`, `mcp`, `lsp`, `operations` from '@keel/cli'. Seed 1337.
// Spec: k.cli, clause "For a fixture project, `keel check --format=json`, the MCP `check` tool, and LSP diagnostics yield the same set of (code, path, line, col, message)."
import { lsp, mcp, operations, run } from "@keel/cli";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, cleanFile, dirtyFile, keel } from "./fixtures";

const CWD = "/work/app";
const rpc = (id: number, method: string, params: unknown): string =>
  JSON.stringify({ jsonrpc: "2.0", id, method, params });
const frame = (m: unknown): string => {
  const body = JSON.stringify(m);
  return `Content-Length: ${new TextEncoder().encode(body).length}\r\n\r\n${body}`;
};
const records = (out: string): Record<string, unknown>[] =>
  out
    .split("\n")
    .filter((l) => l !== "")
    .map((l): unknown => JSON.parse(l))
    .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v));
const unframe = (out: string): Record<string, unknown>[] =>
  out
    .split(/Content-Length: \d+\r\n\r\n/)
    .filter((b) => b !== "")
    .map((b): unknown => JSON.parse(b))
    .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v));
const project = (n: number) => [cleanFile(1), ...Array.from({ length: n }, (_, i) => dirtyFile(i))];
const key = (d: { code: unknown; path: unknown; line: unknown; col: unknown; message: unknown }): string =>
  JSON.stringify([d.code, d.path, d.line, d.col, d.message]);
const field = (v: unknown, name: string): unknown =>
  typeof v === "object" && v !== null && name in v ? Reflect.get(v, name) : undefined;

describe("k.cli surfaces", () => {
  it("`mcp` and `lsp` are recognized subcommands, not E1051", async () => {
    for (const cmd of ["mcp", "lsp"]) {
      const r = await keel([cmd, "--help"]);
      expect(r.stdout + r.stderr).not.toContain("E1051");
    }
  });

  it("check --format=json, the MCP check tool, and LSP diagnostics yield the same set of (code, path, line, col, message)", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 5 }), async (n) => {
        const files = project(n);
        const cli = (await run(["check", "--format=json"], { cwd: CWD, files })).stdout;
        const fromCli = new Set(
          records(cli)
            .filter((r) => r.kind === "diag")
            .map((d) => key({ code: d.code, path: d.path, line: d.line, col: d.col, message: d.message })),
        );
        expect(fromCli.size).toBe(n * 1);

        const called = await mcp(() => ({ cwd: CWD, files })).receive(
          `${rpc(1, "tools/call", { name: "check", arguments: { format: "json" } })}\n`,
        );
        const content = field(records(called)[0]?.result, "content");
        const text = Array.isArray(content) ? String(field(content[0], "text")) : "";
        const fromMcp = new Set(
          records(text)
            .filter((r) => r.kind === "diag")
            .map((d) => key({ code: d.code, path: d.path, line: d.line, col: d.col, message: d.message })),
        );
        expect(fromMcp).toEqual(fromCli);

        const server = lsp(() => ({ cwd: CWD, files: [] }));
        let out = await server.receive(
          frame({ jsonrpc: "2.0", id: 1, method: "initialize", params: { rootUri: `file://${CWD}` } }),
        );
        for (const f of files)
          out += await server.receive(
            frame({
              jsonrpc: "2.0",
              method: "textDocument/didOpen",
              params: {
                textDocument: { uri: `file://${CWD}/${f.path}`, languageId: "typescript", version: 1, text: f.source },
              },
            }),
          );
        const latest = new Map<string, unknown[]>();
        for (const m of unframe(out)) {
          if (m.method !== "textDocument/publishDiagnostics") continue;
          const diagnostics = field(m.params, "diagnostics");
          if (Array.isArray(diagnostics)) latest.set(String(field(m.params, "uri")), diagnostics);
        }
        const fromLsp = new Set(
          [...latest].flatMap(([uri, ds]) =>
            ds.map((d) => {
              const start = field(field(d, "range"), "start");
              return key({
                code: field(d, "code"),
                path: uri.slice(`file://${CWD}/`.length),
                line: Number(field(start, "line")) + 1,
                col: Number(field(start, "character")) + 1,
                message: field(d, "message"),
              });
            }),
          ),
        );
        expect(fromLsp).toEqual(fromCli);
      }),
      { seed: SEED, numRuns: 6 },
    );
  });

  it("each MCP tool's input schema describes its operation's input: object, same fields, required exactly the non-optional ones, same field types", async () => {
    const out = await mcp(() => ({ cwd: CWD })).receive(`${rpc(1, "tools/list", {})}\n`);
    const list = field(records(out)[0]?.result, "tools");
    const tools = Array.isArray(list) ? list : [];
    expect(tools.map((t) => field(t, "name"))).toEqual(operations.map((o) => o.name));
    const jsonType: Record<string, string> = { string: "string", int: "integer", boolean: "boolean", array: "array" };
    for (const op of operations) {
      const schema = field(
        tools.find((t) => field(t, "name") === op.name),
        "inputSchema",
      );
      const node = op.input.node;
      if (node.kind !== "object") throw new Error(`${op.name}: input is not an object schema`);
      expect(field(schema, "type")).toBe("object");
      const props = field(schema, "properties");
      expect(Object.keys(typeof props === "object" && props !== null ? props : {}).sort()).toEqual(
        Object.keys(node.fields).sort(),
      );
      const required = field(schema, "required");
      expect((Array.isArray(required) ? required : []).sort()).toEqual(
        Object.entries(node.fields)
          .filter(([, f]) => f.kind !== "optional")
          .map(([k]) => k)
          .sort(),
      );
      for (const [k, f] of Object.entries(node.fields)) {
        const inner = f.kind === "optional" ? f.inner : f;
        const want = jsonType[inner.kind];
        if (want !== undefined) expect(field(field(props, k), "type"), `${op.name}.${k}`).toBe(want);
      }
    }
  });

  it("MCP tools/call validates arguments with the input schema (E1052) and names (E1051), as isError", async () => {
    const out = await mcp(() => ({ cwd: CWD, files: [] })).receive(
      `${rpc(1, "tools/call", { name: "check", arguments: { limit: "x" } })}\n${rpc(2, "tools/call", { name: "nope", arguments: {} })}\n`,
    );
    const [bad, unknown] = records(out).map((r) => JSON.stringify(r.result));
    expect(bad).toContain("E1052");
    expect(unknown).toContain("E1051");
    for (const r of [bad, unknown]) expect(r).toContain('"isError":true');
  });
});
