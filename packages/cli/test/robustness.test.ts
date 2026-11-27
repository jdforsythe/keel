// Review fixes: one throw never silences a server; JSON-RPC error codes; malformed LSP frames; file scope and
// effects owned by the engine; writes confined to the project; mcp/lsp streamed through `run`.
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { tempDir } from "@keel/tooling/test-tmp";
import { describe, expect, it } from "vitest";
import { lsp, mcp, run } from "../src/index.ts";
import { applyWrites } from "../src/internal/applyWrites.ts";
import type { FileScope } from "../src/types/FileScope.ts";
import type { Io } from "../src/types/Io.ts";
import type { Write } from "../src/types/Write.ts";

const CWD = "/work/app";
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
const codeOf = (r: Record<string, unknown> | undefined): unknown =>
  typeof r?.error === "object" && r.error !== null && "code" in r.error ? r.error.code : undefined;
async function* chunks(...parts: string[]): AsyncIterable<string> {
  for (const p of parts) yield p;
}

describe("MCP JSON-RPC errors", () => {
  it("-32700 unparsable, -32600 batch / response / bad id / no jsonrpc, notifications get nothing", async () => {
    const out = await mcp(() => ({ cwd: CWD })).receive(
      [
        "{not json",
        "[]",
        '{"jsonrpc":"2.0","id":4,"result":{}}',
        '{"jsonrpc":"2.0","id":{},"method":"ping"}',
        '{"id":6,"method":"ping"}',
        '{"jsonrpc":"2.0","method":"notifications/initialized"}',
        "",
      ].join("\n"),
    );
    const rs = replies(out);
    expect(rs.map(codeOf)).toEqual([-32700, -32600, -32600, -32600, -32600]);
    expect(rs.map((r) => r.id)).toEqual([null, null, 4, null, 6]);
  });

  it("a throw while serving one request is -32603 for that request; the next request is still served", async () => {
    const io: Io = {
      cwd: CWD,
      load: () => {
        throw new Error("disk on fire");
      },
    };
    const call = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "check", arguments: {} },
    });
    const out = await mcp(() => io).receive(`${call}\n{"jsonrpc":"2.0","id":2,"method":"ping"}\n`);
    const [failed, ping] = replies(out);
    expect(codeOf(failed)).toBe(-32603);
    expect(JSON.stringify(failed)).toContain("disk on fire");
    expect(ping).toEqual({ jsonrpc: "2.0", id: 2, result: {} });
  });
});

describe("LSP robustness", () => {
  it("a malformed header is answered with a -32700 error frame and the next message is served", async () => {
    const out = unframe(
      await lsp(() => ({ cwd: CWD, files: [] })).receive(
        `X-Nothing: 1\r\n\r\n${frame({ jsonrpc: "2.0", id: 1, method: "shutdown" })}`,
      ),
    );
    expect(codeOf(out[0])).toBe(-32700);
    expect(out[1]).toEqual({ jsonrpc: "2.0", id: 1, result: null });
  });

  it("a throw in a notification becomes window/logMessage; a bad rootUri escape does not throw", async () => {
    let calls = 0;
    const server = lsp(() => {
      calls++;
      if (calls === 1) throw new Error("load failed");
      return { cwd: CWD, files: [] };
    });
    const init = { jsonrpc: "2.0", id: 1, method: "initialize", params: { rootUri: "file:///work/%E0%A4%A" } };
    expect(unframe(await server.receive(frame(init)))[0]).toMatchObject({ id: 1 });
    const open = { textDocument: { uri: "file:///work/%E0%A4%A/src/a.ts", text: "export const a = 1\n" } };
    const first = unframe(
      await server.receive(frame({ jsonrpc: "2.0", method: "textDocument/didOpen", params: open })),
    );
    expect(first[0]).toMatchObject({ method: "window/logMessage", params: { type: 1 } });
    const second = unframe(
      await server.receive(frame({ jsonrpc: "2.0", method: "textDocument/didChange", params: open })),
    );
    expect(second[0]).toMatchObject({ method: "textDocument/publishDiagnostics" });
  });
});

describe("engine owns file scope and effects", () => {
  it("each operation loads its own scope; effects of a successful run reach io.apply, failures apply nothing", async () => {
    const asked: FileScope[] = [];
    const applied: (readonly Write[])[] = [];
    const io: Io = {
      cwd: CWD,
      load: (scope) => {
        asked.push(scope);
        return [];
      },
      apply: (w) => void applied.push(w),
    };
    await run(["check"], io);
    await run(["explain", "E1051"], io);
    await run(["scaffold", "module", "orders"], io);
    // explain reads no files, so `load` is never asked for "none"
    expect(asked).toEqual(["query", "tree"]);
    expect(applied).toHaveLength(0);
    const ok = await run(["scaffold", "project", "shop"], io);
    expect(ok.code).toBe(0);
    expect(applied).toHaveLength(1);
    expect(applied[0]?.some((w) => w.path === "shop/topology.ts")).toBe(true);
  });

  it("mcp and lsp stream through run: replies are emitted as stdin arrives; lsp exit ends the stream", async () => {
    const emitted: string[] = [];
    const ping = (id: number): string => `${JSON.stringify({ jsonrpc: "2.0", id, method: "ping" })}\n`;
    const r = await run(["mcp"], {
      cwd: CWD,
      stdin: chunks(ping(1), ping(2).slice(0, 10), ping(2).slice(10)),
      emit: (t) => void emitted.push(t),
    });
    expect(r.stdout).toBe("");
    expect(emitted.map((e) => replies(e)[0]?.id)).toEqual([1, 2]);
    const l = await run(["lsp"], {
      cwd: CWD,
      stdin: chunks(frame({ jsonrpc: "2.0", method: "exit" }), frame({ jsonrpc: "2.0", id: 9, method: "shutdown" })),
    });
    expect(l.stdout).toBe("");
  });
});

describe("applyWrites", () => {
  it("writes inside the project, read-only when asked; anything resolving outside rejects the whole set", () => {
    const dir = tempDir("keel-cli-");
    applyWrites(dir, [{ path: ".keel/a.json", content: "{}\n", readonly: true }]);
    expect(readFileSync(join(dir, ".keel/a.json"), "utf8")).toBe("{}\n");
    expect(statSync(join(dir, ".keel/a.json")).mode & 0o777).toBe(0o444);
    for (const bad of ["../escape.txt", "/etc/keel.txt", "a/../../escape.txt", "."]) {
      const set: Write[] = [
        { path: "fine.txt", content: "x", readonly: false },
        { path: bad, content: "x", readonly: false },
      ];
      expect(() => applyWrites(dir, set)).toThrow(/outside/);
      expect(() => statSync(join(dir, "fine.txt"))).toThrow();
    }
  });
});
