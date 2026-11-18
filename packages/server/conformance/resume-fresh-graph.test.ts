import { tx } from "@keel/store";
// @vitest-environment happy-dom
// Spec: k.resume, Conformance "Served documents resume in a client module graph of their own (k.testing `resumeDocument`): a store created while a level renders restores with no warning; a module store is at its initial state."
// Spec: k.resume, Stores "A store created in the request goes to `#k-state`; at resume its snapshot restores the store of its id in `stores`, else one an island creates resuming; else E1253."
// Seed: 1337 (no generated inputs). The server side is this test's module graph; the client side is the graph `resumeDocument` makes
// for `routes: () => import(...)`, with its own `@keel/store` and so its own module registry. `resumeDocument` rejects with E1720 on a resume warning.
import { resumeDocument } from "@keel/testing";
import { afterEach, describe, expect, it } from "vitest";
import { serveRoutes } from "./resume-graph-app.ts";
import { routes } from "./resume-graph-routes.ts";
import { PRISTINE, board, setRows } from "./resume-modstore.ts";

const MODULES = ["gl", "gc", "gr"];

afterEach(() => {
  board.restore(PRISTINE);
});

const client = (html: string) => resumeDocument(html, { routes: () => import("./resume-graph-routes.ts") });

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/** The document with `mutate` applied to its `#k-state` JSON. */
function withState(html: string, mutate: (state: Record<string, unknown>) => void): string {
  const re = /(<script[^>]*id="k-state"[^>]*>)([\s\S]*?)(<\/script>)/;
  const m = re.exec(html);
  if (m === null) throw new Error("fixture: no #k-state");
  const state: unknown = JSON.parse(m[2] ?? "");
  if (!isRecord(state)) throw new Error("fixture: #k-state is not an object");
  mutate(state);
  return html.replace(
    re,
    (_all, open: string, _body: string, close: string) => `${open}${JSON.stringify(state)}${close}`,
  );
}

describe("k.resume: served documents resume in a client module graph of their own", () => {
  it("a store created in the request reaches #k-state, whether a loader or a render created it", async () => {
    for (const [path, id] of [
      ["/local", "p.local"],
      ["/created", "p.created"],
    ] as const) {
      const doc = await serveRoutes(routes, MODULES, path);
      expect(doc.status).toBe(200);
      const m = /<script[^>]*id="k-state"[^>]*>([\s\S]*?)<\/script>/.exec(doc.text);
      const state: unknown = JSON.parse(m?.[1] ?? "null");
      expect(isRecord(state) && isRecord(state.stores) ? Object.keys(state.stores) : []).toEqual([id]);
    }
  });

  it("a store created while a level renders restores in a fresh graph with no warning, and state() holds it", async () => {
    const doc = await serveRoutes(routes, MODULES, "/created");
    const t = await client(doc.text);
    expect(t.state()["p.created"]).toEqual({ n: 7 });
    t.dispose();
  });

  it("a store an island creates while it resumes takes its waiting snapshot: the client has no such store, and the island starts it from the snapshot", async () => {
    const doc = await serveRoutes(routes, MODULES, "/local");
    const t = await client(doc.text);
    expect(t.state()["p.local"]).toEqual({ n: 3 });
    t.dispose();
  });

  it("a module store the page reads and the request never wrote is at its initial state on the client after the test wrote another value into its own instance", async () => {
    void tx(setRows, { rows: "written" });
    expect(board.get("rows")).toBe("written");
    const doc = await serveRoutes(routes, MODULES, "/read");
    expect(doc.status).toBe(200);
    expect(doc.text).toContain("written");
    expect(doc.text).not.toContain('"rm.board"');
    const t = await client(doc.text);
    expect(t.state()["rm.board"]).toEqual({ rows: "" });
    expect(board.get("rows")).toBe("written");
    t.dispose();
  });

  it("an untouched module store resumes at its initial state", async () => {
    const doc = await serveRoutes(routes, MODULES, "/read");
    const t = await client(doc.text);
    expect(t.state()["rm.board"]).toEqual({ rows: "" });
    t.dispose();
  });

  it("a #k-state snapshot for an id no store takes is a warning: E1720 from resumeDocument", async () => {
    const doc = await serveRoutes(routes, MODULES, "/created");
    const ghost = withState(doc.text, (state) => {
      const stores = state.stores;
      if (!isRecord(stores)) throw new Error("fixture: no stores in #k-state");
      stores["ghost.nobody"] = stores["p.created"];
    });
    await expect(client(ghost)).rejects.toMatchObject({ code: "E1720" });
  });

  it("the same document without the unclaimed snapshot resumes with no warning", async () => {
    const doc = await serveRoutes(routes, MODULES, "/local");
    const same = withState(doc.text, () => undefined);
    const t = await client(same);
    expect(t.state()["p.local"]).toEqual({ n: 3 });
    t.dispose();
  });
});
