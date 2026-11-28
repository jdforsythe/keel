// Mutation-killing tests for the LSP handler, hover, code actions, diagnostics mapping and publishing.
import { describe, expect, it } from "vitest";
import type { Diag } from "../src/internal/Diag.ts";
import type { LspState } from "../src/internal/LspState.ts";
import { explainCommand } from "../src/internal/explainCommand.ts";
import { lspCodeActions } from "../src/internal/lspCodeActions.ts";
import { lspDiagnostic } from "../src/internal/lspDiagnostic.ts";
import { lspHandle } from "../src/internal/lspHandle.ts";
import { lspHover } from "../src/internal/lspHover.ts";
import { publishAll } from "../src/internal/publishAll.ts";
import { lsp } from "../src/lsp.ts";
import type { Io } from "../src/types/Io.ts";

const fresh = (): LspState => ({ root: undefined, exited: false, docs: new Map(), diags: new Map() });
const io: Io = { cwd: "/w", files: [] };
const msg = (m: Record<string, unknown>): string => JSON.stringify({ jsonrpc: "2.0", ...m });
const THROWING = "export function x(): number {\n  throw new Error('no')\n}\n";
/** A non-null assertion: E1757 with a fix. */
const FIXABLE = "export const f = (x: string | undefined): number => x!.length\n";
const TWO = "export const a = 1\nexport const b = 2\n";
const frame = (m: unknown): string => {
  const body = JSON.stringify(m);
  return `Content-Length: ${new TextEncoder().encode(body).length}\r\n\r\n${body}`;
};
const d = (over: Partial<Diag> & { code: string }): Diag => ({ kind: "diag", message: "msg", ...over });
const FIX = "--- a/src/x.ts\n+++ b/src/x.ts\n@@ -1,1 +1,1 @@\n-a\n+b";

describe("lspDiagnostic", () => {
  it("maps 1-based line/col to 0-based positions and the first letter to severity", () => {
    expect(lspDiagnostic(d({ code: "E1451", line: 3, col: 5, message: "boom" }))).toEqual({
      range: { start: { line: 2, character: 4 }, end: { line: 2, character: 4 } },
      severity: 1,
      code: "E1451",
      source: "keel",
      message: "boom",
    });
    expect(lspDiagnostic(d({ code: "W1" })).severity).toBe(2);
    expect(lspDiagnostic(d({ code: "I1055" })).severity).toBe(3);
    expect(lspDiagnostic(d({ code: "XE" })).severity).toBe(3);
    expect(lspDiagnostic(d({ code: "XW" })).severity).toBe(3);
  });

  it("absent or zero positions clamp to 0", () => {
    expect(lspDiagnostic(d({ code: "E1" })).range).toEqual({
      start: { line: 0, character: 0 },
      end: { line: 0, character: 0 },
    });
    expect(lspDiagnostic(d({ code: "E1", line: 0, col: 0 })).range).toEqual({
      start: { line: 0, character: 0 },
      end: { line: 0, character: 0 },
    });
    expect(lspDiagnostic(d({ code: "E1", line: 1, col: 9 })).range).toEqual({
      start: { line: 0, character: 8 },
      end: { line: 0, character: 8 },
    });
  });
});

describe("lspCodeActions", () => {
  const stateWith = (...ds: Diag[]): LspState => {
    const s = fresh();
    s.diags.set("file:///w/src/x.ts", ds);
    return s;
  };
  const uri = "file:///w/src/x.ts";
  const range = (from: number, to: number) => ({ start: { line: from }, end: { line: to } });

  it("builds the exact quick fix", () => {
    const dd = d({ code: "E1451", line: 3, col: 2, message: "m", fix: FIX });
    const acts = lspCodeActions(stateWith(dd), "/root", { textDocument: { uri }, range: range(0, 9) });
    expect(acts).toEqual([
      {
        title: "Fix E1451: m",
        kind: "quickfix",
        diagnostics: [lspDiagnostic(dd)],
        edit: {
          changes: {
            "file:///root/src/x.ts": [
              { range: { start: { line: 0, character: 0 }, end: { line: 1, character: 0 } }, newText: "b\n" },
            ],
          },
        },
      },
    ]);
  });

  it("filters by the range lines inclusively", () => {
    const s = stateWith(d({ code: "E1", line: 3, fix: FIX }));
    const n = (from: number, to: number): number =>
      lspCodeActions(s, "/r", { textDocument: { uri }, range: range(from, to) }).length;
    expect(n(2, 2)).toBe(1);
    expect(n(2, 9)).toBe(1);
    expect(n(0, 2)).toBe(1);
    expect(n(3, 9)).toBe(0);
    expect(n(0, 1)).toBe(0);
  });

  it("a diagnostic without a line counts as line 1; one without a fix yields nothing", () => {
    const s = stateWith(d({ code: "E1", fix: FIX }));
    expect(lspCodeActions(s, "/r", { textDocument: { uri }, range: range(0, 0) })).toHaveLength(1);
    expect(lspCodeActions(s, "/r", { textDocument: { uri }, range: range(1, 5) })).toHaveLength(0);
    expect(lspCodeActions(stateWith(d({ code: "E1", line: 1 })), "/r", { textDocument: { uri } })).toEqual([]);
  });

  it("a missing or malformed range spans the whole document", () => {
    const s = stateWith(d({ code: "E1", line: 1, fix: FIX }), d({ code: "E2", line: 1000000, fix: FIX }));
    expect(lspCodeActions(s, "/r", { textDocument: { uri } })).toHaveLength(2);
    expect(lspCodeActions(s, "/r", { textDocument: { uri }, range: { start: {}, end: {} } })).toHaveLength(2);
    expect(lspCodeActions(s, "/r", { textDocument: { uri }, range: { start: null, end: null } })).toHaveLength(2);
    expect(
      lspCodeActions(s, "/r", { textDocument: { uri }, range: { start: { line: "5" }, end: { line: "0" } } }),
    ).toHaveLength(2);
    expect(lspCodeActions(s, "/r", null)).toEqual([]);
  });

  it("a non-string uri reads the diagnostics kept under the empty uri; unknown uri has none", () => {
    const s = fresh();
    s.diags.set("", [d({ code: "E1", line: 1, fix: FIX })]);
    expect(lspCodeActions(s, "/r", { textDocument: { uri: 5 } })).toHaveLength(1);
    expect(lspCodeActions(s, "/r", { textDocument: { uri: "file:///nope" } })).toEqual([]);
  });
});

describe("lspHover", () => {
  const uri = "file:///w/src/x.ts";
  it("shows the explain text of the diagnostic on the hovered line", async () => {
    const s = fresh();
    s.diags.set(uri, [d({ code: "E1451", line: 2, message: "m" })]);
    const rec = (await explainCommand({ code: "E1451" })).find((r) => r.kind === "explain.text");
    expect(typeof rec?.text).toBe("string");
    expect(await lspHover(s, { textDocument: { uri }, position: { line: 1 } })).toEqual({
      contents: { kind: "markdown", value: rec?.text },
    });
    expect(await lspHover(s, { textDocument: { uri }, position: { line: 0 } })).toBeNull();
    expect(await lspHover(s, { textDocument: { uri }, position: { line: 2 } })).toBeNull();
  });

  it("missing position, unknown uri and malformed params give null", async () => {
    const s = fresh();
    s.diags.set("", [d({ code: "E9999", line: 2 })]);
    s.diags.set(uri, [d({ code: "E9999" })]);
    expect(await lspHover(s, {})).toBeNull();
    expect(await lspHover(s, null)).toBeNull();
    expect(await lspHover(s, { textDocument: { uri }, position: { line: "0" } })).toBeNull();
    expect(await lspHover(s, { textDocument: { uri: "file:///other" }, position: { line: 0 } })).toBeNull();
    expect(Object(await lspHover(s, { textDocument: { uri: 7 }, position: { line: 1 } })).contents.kind).toBe(
      "markdown",
    );
  });
});

describe("lspHandle", () => {
  it("answers unparsable and invalid messages with the exact error reply", async () => {
    expect(await lspHandle("{nope", fresh(), () => io)).toEqual([
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } },
    ]);
    expect(await lspHandle("[]", fresh(), () => io)).toEqual([
      { jsonrpc: "2.0", id: null, error: { code: -32600, message: "batch requests are not supported" } },
    ]);
    expect(await lspHandle(JSON.stringify({ jsonrpc: "1.0", id: 7, method: "x" }), fresh(), () => io)).toEqual([
      { jsonrpc: "2.0", id: 7, error: { code: -32600, message: 'jsonrpc must be "2.0"' } },
    ]);
    expect(await lspHandle(msg({ id: 3, result: {} }), fresh(), () => io)).toEqual([
      { jsonrpc: "2.0", id: 3, error: { code: -32600, message: "not a request: no method" } },
    ]);
  });

  it("initialize replies with capabilities and records the decoded root", async () => {
    const s = fresh();
    const out = await lspHandle(
      msg({ id: 1, method: "initialize", params: { rootUri: "file:///my%20proj" } }),
      s,
      () => io,
    );
    expect(out).toEqual([
      {
        jsonrpc: "2.0",
        id: 1,
        result: {
          capabilities: { textDocumentSync: 1, hoverProvider: true, codeActionProvider: true },
          serverInfo: { name: "keel" },
        },
      },
    ]);
    expect(s.root).toBe("/my proj");
    const s2 = fresh();
    await lspHandle(msg({ id: 1, method: "initialize", params: { rootUri: "/a/file://b" } }), s2, () => io);
    expect(s2.root).toBe("/a/file://b");
  });

  it("initialize without a string rootUri leaves the root unset; as a notification it replies nothing", async () => {
    const s = fresh();
    const out = await lspHandle(msg({ id: 1, method: "initialize", params: { rootUri: 5 } }), s, () => io);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 1, result: { serverInfo: { name: "keel" } } });
    expect(s.root).toBeUndefined();
    await lspHandle(msg({ id: 2, method: "initialize" }), s, () => io);
    expect(s.root).toBeUndefined();
    expect(await lspHandle(msg({ method: "initialize", params: {} }), s, () => io)).toEqual([]);
  });

  it("initialized, shutdown and exit", async () => {
    const s = fresh();
    expect(await lspHandle(msg({ id: 1, method: "initialized" }), s, () => io)).toEqual([]);
    expect(await lspHandle(msg({ method: "initialized" }), s, () => io)).toEqual([]);
    expect(await lspHandle(msg({ id: 2, method: "shutdown" }), s, () => io)).toEqual([
      { jsonrpc: "2.0", id: 2, result: null },
    ]);
    expect(await lspHandle(msg({ method: "shutdown" }), s, () => io)).toEqual([]);
    expect(s.exited).toBe(false);
    expect(await lspHandle(msg({ id: 3, method: "exit" }), s, () => io)).toEqual([]);
    expect(s.exited).toBe(true);
  });

  it("unknown methods: -32601 for a request, nothing for a notification", async () => {
    expect(await lspHandle(msg({ id: 4, method: "foo/bar" }), fresh(), () => io)).toEqual([
      { jsonrpc: "2.0", id: 4, error: { code: -32601, message: "method not found: foo/bar" } },
    ]);
    expect(await lspHandle(msg({ method: "foo/bar" }), fresh(), () => io)).toEqual([]);
  });

  it("didOpen stores the text and publishes exactly one notification; didChange takes the last change", async () => {
    const s = fresh();
    const uri = "file:///w/src/x.ts";
    const opened = await lspHandle(
      msg({ method: "textDocument/didOpen", params: { textDocument: { uri, text: THROWING } } }),
      s,
      () => io,
    );
    expect(opened).toHaveLength(1);
    expect(opened[0]).toMatchObject({
      jsonrpc: "2.0",
      method: "textDocument/publishDiagnostics",
      params: { uri, diagnostics: [{ code: "E1451", severity: 1, source: "keel" }] },
    });
    expect(s.docs.get(uri)).toBe(THROWING);
    const changed = await lspHandle(
      msg({
        method: "textDocument/didChange",
        params: {
          textDocument: { uri },
          contentChanges: [{ text: "export const z = 1\n" }, { text: "export const x = 2\n" }],
        },
      }),
      s,
      () => io,
    );
    expect(s.docs.get(uri)).toBe("export const x = 2\n");
    expect(changed).toEqual([
      { jsonrpc: "2.0", method: "textDocument/publishDiagnostics", params: { uri, diagnostics: [] } },
    ]);
  });

  it("a text in the textDocument wins over the content changes", async () => {
    const s = fresh();
    const uri = "file:///w/src/x.ts";
    await lspHandle(
      msg({
        method: "textDocument/didChange",
        params: {
          textDocument: { uri, text: "export const a = 1\n" },
          contentChanges: [{ text: "export const b = 2\n" }],
        },
      }),
      s,
      () => io,
    );
    expect(s.docs.get(uri)).toBe("export const a = 1\n");
  });

  it("ignores opens and changes without a usable uri or text", async () => {
    const s = fresh();
    const uri = "file:///w/src/x.ts";
    const none = async (params: unknown): Promise<unknown[]> =>
      lspHandle(msg({ method: "textDocument/didChange", params }), s, () => io);
    expect(await none({ textDocument: { text: "export const a = 1\n" } })).toEqual([]);
    expect(await none({ textDocument: { uri: "", text: "export const a = 1\n" } })).toEqual([]);
    expect(await none({ textDocument: { uri: 5, text: "export const a = 1\n" } })).toEqual([]);
    expect(await none({ textDocument: { uri } })).toEqual([]);
    expect(await none({ textDocument: { uri }, contentChanges: [] })).toEqual([]);
    expect(await none({ textDocument: { uri }, contentChanges: [{}] })).toEqual([]);
    expect(await none({ textDocument: { uri }, contentChanges: [{ text: 5 }] })).toEqual([]);
    expect(await none({ textDocument: { uri }, contentChanges: ["export const a = 1\n"] })).toEqual([]);
    expect(await none({ textDocument: { uri }, contentChanges: "x" })).toEqual([]);
    expect(await none(null)).toEqual([]);
    expect(s.docs.size).toBe(0);
  });

  it("didClose drops the document and publishes an empty list for it", async () => {
    const s = fresh();
    const uri = "file:///w/src/x.ts";
    s.docs.set(uri, THROWING);
    s.diags.set(uri, [d({ code: "E1" })]);
    const out = await lspHandle(
      msg({ method: "textDocument/didClose", params: { textDocument: { uri } } }),
      s,
      () => io,
    );
    expect(out).toEqual([
      { jsonrpc: "2.0", method: "textDocument/publishDiagnostics", params: { uri, diagnostics: [] } },
    ]);
    expect(s.docs.has(uri)).toBe(false);
    expect(s.diags.has(uri)).toBe(false);
  });

  it("codeAction resolves paths under the root, else under the provided cwd", async () => {
    const uri = "file:///w/src/x.ts";
    const ask = async (s: LspState, cwd: string): Promise<unknown> => {
      await lspHandle(
        msg({ method: "textDocument/didOpen", params: { textDocument: { uri, text: FIXABLE } } }),
        s,
        () => ({ cwd, files: [] }),
      );
      const out = await lspHandle(
        msg({
          id: 5,
          method: "textDocument/codeAction",
          params: { textDocument: { uri }, range: { start: { line: 0 }, end: { line: 9 } } },
        }),
        s,
        () => ({ cwd, files: [] }),
      );
      return out;
    };
    const keysOf = (out: unknown): string[] => {
      const first = Array.isArray(out) ? out[0] : undefined;
      const result = typeof first === "object" && first !== null && "result" in first ? first.result : undefined;
      const act = Array.isArray(result) ? result[0] : undefined;
      const changes =
        typeof act === "object" && act !== null && "edit" in act
          ? Object(Reflect.get(Object(act.edit), "changes"))
          : {};
      return Object.keys(changes);
    };
    const rooted = fresh();
    rooted.root = "/w";
    expect(keysOf(await ask(rooted, "/elsewhere"))).toEqual(["file:///w/src/x.ts"]);
    expect(keysOf(await ask(fresh(), "/w"))).toEqual(["file:///w/src/x.ts"]);
    expect(keysOf(await ask(fresh(), "/w/cwd2"))).toEqual(["file:///w/cwd2/../src/x.ts"]);
  });

  it("hover through the handler replies with the explain text", async () => {
    const s = fresh();
    const uri = "file:///w/src/x.ts";
    s.diags.set(uri, [d({ code: "E1451", line: 2 })]);
    const out = await lspHandle(
      msg({ id: 6, method: "textDocument/hover", params: { textDocument: { uri }, position: { line: 1 } } }),
      s,
      () => io,
    );
    expect(out).toEqual([
      { jsonrpc: "2.0", id: 6, result: await lspHover(s, { textDocument: { uri }, position: { line: 1 } }) },
    ]);
    expect(JSON.stringify(out)).toContain("E1451");
    expect(await lspHandle(msg({ method: "textDocument/hover", params: {} }), s, () => io)).toEqual([]);
  });

  it("a throw while serving is -32603 for a request and a logMessage for a notification", async () => {
    const boom = (): Io => {
      throw new Error("boom\nsecond line");
    };
    const params = { textDocument: { uri: "file:///w/a.ts", text: "export const a = 1\n" } };
    expect(await lspHandle(msg({ id: 9, method: "textDocument/didOpen", params }), fresh(), boom)).toEqual([
      { jsonrpc: "2.0", id: 9, error: { code: -32603, message: "internal error: textDocument/didOpen: boom" } },
    ]);
    expect(await lspHandle(msg({ method: "textDocument/didOpen", params }), fresh(), boom)).toEqual([
      { jsonrpc: "2.0", method: "window/logMessage", params: { type: 1, message: "keel: textDocument/didOpen: boom" } },
    ]);
  });
});

describe("publishAll", async () => {
  it("the open document replaces the file of the same path and diagnostics carry project-relative paths", async () => {
    const s = fresh();
    s.docs.set("file:///w/src/x.ts", TWO);
    const out = await publishAll(s, { cwd: "/w", files: [{ path: "src/x.ts", source: "export const x = 1\n" }] });
    expect(out).toHaveLength(1);
    expect(s.diags.get("file:///w/src/x.ts")?.map((x) => [x.code, x.path])).toEqual([["E1752", "src/x.ts"]]);
    expect(out[0]).toMatchObject({
      jsonrpc: "2.0",
      method: "textDocument/publishDiagnostics",
      params: { uri: "file:///w/src/x.ts", diagnostics: [{ code: "E1752" }] },
    });
  });

  it("uses the state root over the io cwd, and asks the loader for the query scope", async () => {
    const s = fresh();
    s.root = "/w";
    s.docs.set("file:///w/src/x.ts", TWO);
    const scopes: string[] = [];
    await publishAll(s, {
      cwd: "/other",
      load: (scope) => {
        scopes.push(scope);
        return [];
      },
    });
    expect(scopes).toEqual(["query"]);
    expect(s.diags.get("file:///w/src/x.ts")?.map((x) => x.path)).toEqual(["src/x.ts"]);
  });

  it("with no open document and nothing closed it publishes nothing; closed uris get empty lists after the open ones", async () => {
    const s = fresh();
    expect(await publishAll(s, io)).toEqual([]);
    s.docs.set("file:///w/src/b.ts", TWO);
    s.diags.set("file:///w/src/a.ts", [d({ code: "E1" })]);
    const out = await publishAll(s, io, ["file:///w/src/a.ts"]);
    expect(out.map((o) => Object(o.params).uri)).toEqual(["file:///w/src/b.ts", "file:///w/src/a.ts"]);
    expect(Object(out[1]?.params).diagnostics).toEqual([]);
    expect(s.diags.has("file:///w/src/a.ts")).toBe(false);
  });
});

describe("lsp server", () => {
  it("frames after an exit in the same chunk are not served; a malformed header is a -32700 frame", async () => {
    const server = lsp(() => io);
    const out = await server.receive(
      frame({ jsonrpc: "2.0", method: "exit" }) + frame({ jsonrpc: "2.0", id: 1, method: "shutdown" }),
    );
    expect(out).toBe("");
    expect(server.done()).toBe(true);
    const fresh2 = lsp(() => io);
    const bad = await fresh2.receive("X-Other: 1\r\n\r\n");
    expect(bad).toContain('"code":-32700');
    expect(bad).toContain("malformed header");
  });
});
