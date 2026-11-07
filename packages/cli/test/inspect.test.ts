// `keel inspect [url]` (k.cli Inspect, RFC 0017): fetches GET /__keel/inspect through `io.fetch` and summarizes it.
import { describe, expect, it } from "vitest";
import { run } from "../src/index.ts";

const CWD = "/work/app";
const DOC = {
  live: true,
  graph: {
    nodes: [
      { id: 1, kind: "scope" },
      { id: 2, kind: "signal" },
    ],
    edges: [{ from: 2, to: 1 }],
  },
  stores: {
    "todos.board": { state: { lists: [] }, log: [{ id: 1, name: "todos.addList", payload: {}, at: 1 }] },
    "app.empty": { state: {}, log: [] },
  },
  ids: { "todos.home": { tag: "a" } },
  a11y: { "todos.home": { role: "link" } },
  routes: { "todos.index": { path: "/" }, "todos.list": { path: "/lists/:listId" } },
};

const serving = (body: unknown, status = 200, seen: string[] = []) => ({
  cwd: CWD,
  fetch: (url: string): Promise<Response> => {
    seen.push(url);
    return Promise.resolve(new Response(typeof body === "string" ? body : JSON.stringify(body), { status }));
  },
});

describe("keel inspect", () => {
  it("prints one line per store (sorted) and a counts trailer; default url is the Vite dev port", async () => {
    const seen: string[] = [];
    const r = await run(["inspect", "--format=compact"], serving(DOC, 200, seen));
    expect(seen).toEqual(["http://localhost:5173/__keel/inspect"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toBe(
      [
        "app.empty 0 entries",
        "todos.board 1 entries, last todos.addList",
        "ok inspect live 2 nodes, 1 edges, 2 stores, 1 ids, 1 a11y, 2 routes, 0 sections",
        "",
      ].join("\n"),
    );
  });

  it("takes the url positionally (trailing slashes dropped); a page that never reported is not live", async () => {
    const seen: string[] = [];
    const doc = { ...DOC, live: false, graph: { nodes: [], edges: [] }, stores: {} };
    const r = await run(["inspect", "http://localhost:4180//", "--format=compact"], serving(doc, 200, seen));
    expect(seen).toEqual(["http://localhost:4180/__keel/inspect"]);
    expect(r.stdout).toBe(
      "ok inspect (no live page) 0 nodes, 0 edges, 0 stores, 1 ids, 1 a11y, 2 routes, 0 sections\n",
    );
  });

  it("json: every line parses, the store records are encoded by their schema, the last is the summary", async () => {
    const r = await run(["inspect", "--format=json"], serving(DOC));
    const lines = r.stdout
      .trim()
      .split("\n")
      .map((l): unknown => JSON.parse(l));
    expect(lines[1]).toEqual({ kind: "inspect.store", id: "todos.board", entries: 1, last: "todos.addList" });
    expect(lines[2]).toMatchObject({ kind: "summary", ok: true, name: "inspect live" });
  });

  it("pretty names stores and log entries", async () => {
    const r = await run(["inspect", "--format=pretty"], serving(DOC));
    expect(r.stdout).toContain("store todos.board: 1 log entries (last todos.addList)");
  });

  it("E1056 (exit 1) when unreachable, not 2xx, not JSON, or not an inspect document", async () => {
    const down = {
      cwd: CWD,
      fetch: (): Promise<Response> => Promise.reject(new TypeError("fetch failed")),
    };
    const cases = [
      [await run(["inspect", "http://localhost:1", "--format=compact"], down), "unreachable"],
      [await run(["inspect", "--format=compact"], serving(DOC, 404)), "answered 404"],
      [await run(["inspect", "--format=compact"], serving("<html>")), "not an inspect document"],
      [await run(["inspect", "--format=compact"], serving({ ...DOC, graph: [] })), "not an inspect document"],
    ] as const;
    for (const [r, why] of cases) {
      expect(r.code).toBe(1);
      expect(r.stdout).toMatch(new RegExp(`^E1056 .*${why}`));
      expect(r.stdout.trim().split("\n").at(-1)).toBe("fail inspect");
    }
    const long = await run(["inspect", `http://localhost:1/${"x".repeat(80)}`, "--format=compact"], down);
    expect(long.stdout.split("\n")[0]?.length).toBeLessThanOrEqual(120);
    expect(long.stdout).toContain("...");
  });

  it("without io.fetch (in-process engine) it is I1055, exit 0", async () => {
    const r = await run(["inspect"], { cwd: CWD });
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/^I1055 inspect not available: needs a network/);
  });

  it("sections (RFC 0042): compact clips each value, an error is E1057 with exit 1; MCP inspect carries the same records", async () => {
    const sections = {
      "orders.recent": { doc: "{ n: int }", value: { n: 2 } },
      "audit.tail": { doc: "string", error: "E1057 inspector section audit.tail read threw: boom" },
    };
    const doc = { ...DOC, sections };
    const r = await run(["inspect", "--format=compact"], serving(doc));
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("E1057 inspector section audit.tail read threw: boom");
    expect(r.stdout).toContain('section orders.recent {"n":2}');
    expect(r.stdout).toContain("2 sections");
    const stdin = `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "inspect", arguments: {} } })}\n`;
    const m = await run(["mcp"], { ...serving(doc), stdin });
    const reply: unknown = JSON.parse(m.stdout.trim());
    const text = JSON.stringify(reply);
    expect(text).toContain('"kind":"inspect.section","id":"orders.recent"');
    expect(text).toContain('"code":"E1057"');
    expect(text).toContain('"isError":true');
  });
});
