// Finding 0082 under plain Node (happy-dom strips `cookie` and `set-cookie` at construction): a process-shared store's
// transaction log never reaches `#k-state` or runtime JSON, whatever the number of writes; `undoOwn`/`canUndoOwn` act
// only on the last entry the current caller (`keel-caller` cookie) committed, so two interleaving clients each undo
// only their own writes.
import { createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { action, loader, manifest } from "@keel/router";
import { err, ok, s } from "@keel/schema";
import { store, transaction, tx } from "@keel/store";
import { describe, expect, it } from "vitest";
import { canUndoOwn, createApp, topology, undoOwn } from "../src/index.ts";

const BASE = "http://localhost";
const Notes = s.object({ items: s.array(s.string()), last: s.string() });
const NotesView = s.object({ items: s.array(s.string()), canUndo: s.boolean() });
const empty = { items: [], last: "" };
const notes = scope(() => undefined).run(() => store(Notes, empty, { id: "test0082.notes" }));
const addNote = transaction(notes, "test0082.addNote", s.object({ text: s.string() }), (st, p) => ({
  ...st,
  items: [...st.items, p.text],
}));
const markNote = transaction(notes, "test0082.markNote", s.object({ text: s.string() }), (st, p) => ({
  ...st,
  last: p.text,
}));

const reset = () => expect(notes.restore({ state: empty, log: [], initial: empty }).ok).toBe(true);

function build(https = false) {
  const routes = manifest({
    "app.notes": {
      path: "/notes",
      loader: loader({ output: NotesView }, async () => ok({ items: notes.get("items"), canUndo: canUndoOwn(notes) })),
      actions: {
        POST: action({ input: s.object({ text: s.string() }) }, (input) => {
          const r = tx(addNote, input);
          return r.ok ? ok(null) : err(r.error);
        }),
      },
      component: () => document.createElement("p"),
    },
    "app.mark": {
      path: "/mark",
      actions: {
        POST: action({ input: s.object({ text: s.string() }) }, (input) => {
          const r = tx(markNote, input);
          return r.ok ? ok(null) : err(r.error);
        }),
        // Commits after an await: not attributable to this request, so nobody may undoOwn it.
        PUT: action({ input: s.object({ text: s.string() }) }, async (input) => {
          await Promise.resolve();
          const r = tx(markNote, input);
          return r.ok ? ok(null) : err(r.error);
        }),
      },
      component: () => document.createElement("p"),
    },
    "app.undo": {
      path: "/undo",
      actions: {
        POST: action({ input: s.object({}) }, () =>
          undoOwn(notes) ? ok(null) : err({ code: "keel.denied", message: "Nothing of yours to undo", data: {} }),
        ),
      },
      component: () => document.createElement("p"),
    },
  });
  const base = https ? "https://localhost" : BASE;
  return {
    base,
    app: createApp({
      topology: topology({ web: { modules: ["app"], adapter: "node" } }),
      routes,
      ctx: createCtx({ mode: "sim", seed: 1337 }),
      expose: [notes],
    }),
  };
}

/** A client with its own cookie jar (`keel-caller` only), sending runtime JSON requests. */
function client(built: ReturnType<typeof build>) {
  let jar = "";
  const send = async (method: string, path: string, body?: unknown): Promise<Response> => {
    const headers = new Headers({ accept: "application/json" });
    if (body !== undefined) headers.set("content-type", "application/json");
    if (jar !== "") headers.set("cookie", jar);
    const init = body === undefined ? { method, headers } : { method, headers, body: JSON.stringify(body) };
    const res = await (await built.app).fetch(new Request(`${built.base}${path}`, init));
    const set = res.headers.get("set-cookie");
    if (set !== null) jar = set.split(";")[0] ?? "";
    return res;
  };
  return {
    send,
    write: (text: string) => send("POST", "/notes", { text }),
    undo: () => send("POST", "/undo", {}),
    view: async () => (await (await send("GET", "/notes")).json()).results["app.notes"].value,
    cookie: () => jar,
  };
}

describe("snapshot: no transaction log leaves the server (0082)", () => {
  const sizes = async (n: number) => {
    reset();
    const built = build();
    const c = client(built);
    for (let i = 0; i < n; i++) expect((await c.send("POST", "/mark", { text: "same" })).status).toBe(200);
    const app = await built.app;
    const html = await (await app.fetch(new Request(`${BASE}/notes`, { headers: { accept: "text/html" } }))).text();
    const json = await (await c.send("GET", "/notes")).text();
    return { html, json };
  };
  it("#k-state and the loader JSON hold no transaction names and do not grow with the number of writes", async () => {
    const one = await sizes(1);
    const fifty = await sizes(50);
    for (const body of [one.html, one.json, fifty.html, fifty.json]) expect(body).not.toContain("test0082.markNote");
    expect(fifty.html).toContain('"test0082.notes":{"state":');
    expect(fifty.html).toContain('"log":[]');
    expect(fifty.html.length).toBe(one.html.length);
    expect(fifty.json.length).toBe(one.json.length);
    expect(notes.log()).toHaveLength(50);
  });
});

describe("undo is scoped to the caller (0082)", () => {
  it("issues an HttpOnly, SameSite=Lax caller cookie on a first write only; Secure over https", async () => {
    reset();
    const c = client(build());
    const read = await c.send("GET", "/notes");
    expect(read.headers.get("set-cookie")).toBeNull();
    const first = await c.write("a");
    expect(first.headers.get("set-cookie")).toMatch(
      /^keel-caller=[A-Za-z0-9-]{16,64}; Path=\/; HttpOnly; SameSite=Lax$/,
    );
    expect((await c.write("b")).headers.get("set-cookie")).toBeNull();
    const secure = await client(build(true)).write("c");
    expect(secure.headers.get("set-cookie")).toMatch(/; HttpOnly; SameSite=Lax; Secure$/);
  });

  it("two interleaving clients each undo only their own last write", async () => {
    reset();
    const built = build();
    const a = client(built);
    const b = client(built);
    expect((await a.write("a1")).status).toBe(200);
    expect((await b.write("b1")).status).toBe(200);
    expect(a.cookie()).not.toBe(b.cookie());
    expect(await a.view()).toEqual({ items: ["a1", "b1"], canUndo: false });
    expect(await b.view()).toEqual({ items: ["a1", "b1"], canUndo: true });

    const refused = await a.undo();
    expect([refused.status, (await refused.json()).error.code]).toEqual([403, "keel.denied"]);
    expect(notes.get("items")).toEqual(["a1", "b1"]);

    expect((await b.undo()).status).toBe(200);
    expect(notes.get("items")).toEqual(["a1"]);
    expect((await b.undo()).status).toBe(403);
    expect(await a.view()).toEqual({ items: ["a1"], canUndo: true });
    expect((await a.undo()).status).toBe(200);
    expect(notes.get("items")).toEqual([]);
    expect((await a.undo()).status).toBe(403);
  });

  it("a client without the cookie, or with a forged or malformed one, undoes nothing", async () => {
    reset();
    const built = build();
    const a = client(built);
    await a.write("a1");
    const app = await built.app;
    const tries = ["", "keel-caller=00000000-0000-4000-8000-000000000000", "keel-caller=<script>", "keel-caller="];
    for (const cookie of tries) {
      const headers = new Headers({ accept: "application/json", "content-type": "application/json" });
      if (cookie !== "") headers.set("cookie", cookie);
      const res = await app.fetch(new Request(`${BASE}/undo`, { method: "POST", headers, body: "{}" }));
      expect(res.status).toBe(403);
    }
    expect(notes.get("items")).toEqual(["a1"]);
    expect((await a.undo()).status).toBe(200);
  });

  it("a write committed after an await is nobody's to undo; undoOwn and canUndoOwn outside a request are false", async () => {
    reset();
    const a = client(build());
    expect((await a.send("PUT", "/mark", { text: "late" })).status).toBe(200);
    expect(notes.log()).toHaveLength(1);
    expect((await a.undo()).status).toBe(403);
    expect(canUndoOwn(notes)).toBe(false);
    expect(undoOwn(notes)).toBe(false);
    expect(notes.log()).toHaveLength(1);
  });
});
