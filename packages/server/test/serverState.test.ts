// k.server Server state (RFC 0044) under plain Node (happy-dom strips `cookie` and `set-cookie` at construction):
// `stores` factories get a fresh instance per request, restored from and saved to `ctx.storage`; the caller token
// rides on `tx` meta, so undo is scoped across requests and `await`s; factory stores never reach `#k-state`.
import { createHash } from "node:crypto";
import { type Ctx, createCtx } from "@keel/ctx";
import { action, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { err, ok, s } from "@keel/schema";
import { store, transaction, tx } from "@keel/store";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";

const BASE = "http://localhost";
const KEY = "keel.store.test.notes";
const Notes = s.object({ items: s.array(s.string()) });
const NotesView = s.object({ items: s.array(s.string()), canUndo: s.boolean() });
const Text = s.object({ text: s.string() });

const notesStores = () => {
  const notes = store(Notes, { items: [] }, { id: "test.notes" });
  const add = transaction(notes, "test.add", Text, (st, p) => ({ items: [...st.items, p.text] }));
  return { notes, add };
};
/** A factory whose store has no explicit id: its storage key would change every request. */
const anonymous = () => ({ notes: store(Notes, { items: [] }) });
const denied = { code: "keel.denied", message: "Nothing of yours to undo", data: {} } as const;

const c = contract("app", {
  "app.notes": { path: "/notes" },
  "app.undo": { path: "/undo" },
  "app.anon": { path: "/anon" },
});
const notesLoad = loader(c, "app.notes", { output: NotesView, stores: notesStores }, async ({ caller, stores }) =>
  ok({ items: stores.notes.get("items"), canUndo: stores.notes.log().at(-1)?.meta?.caller === caller }),
);
const anonLoad = loader(c, "app.anon", { output: s.object({}), stores: anonymous }, async () => ok({}));
const notesPost = action(c, "app.notes", { input: Text, stores: notesStores }, (input, { caller, stores }) => {
  const r = tx(stores.add, input, { meta: { caller } });
  return r.ok ? ok(null) : err(r.error);
});
// Commits after an await: the caller still rides on the entry.
const notesPut = action(c, "app.notes", { input: Text, stores: notesStores }, async (input, { caller, stores }) => {
  await Promise.resolve();
  const r = tx(stores.add, input, { meta: { caller } });
  return r.ok ? ok(null) : err(r.error);
});
// Commits, then fails: nothing is saved and the re-render reads storage.
const notesPatch = action(c, "app.notes", { input: Text, stores: notesStores }, (input, { stores }) => {
  tx(stores.add, input);
  return err({ code: "keel.fields", message: "bad", data: { text: "rejected" } });
});
const undoPost = action(c, "app.undo", { input: s.object({}), stores: notesStores }, (_, { caller, stores }) =>
  stores.notes.undoWhere((e) => e.meta?.caller === caller) ? ok(null) : err(denied),
);
const routes = manifest(c, {
  "app.notes": {
    loader: notesLoad,
    component: ({ data }) => {
      const p = document.createElement("p");
      p.textContent = JSON.stringify(data);
      return p;
    },
    POST: notesPost,
    PUT: notesPut,
    PATCH: notesPatch,
  },
  "app.undo": { component: () => document.createElement("p"), POST: undoPost },
  "app.anon": { loader: anonLoad, component: () => document.createElement("p") },
});

function build(ctx: Ctx = createCtx({ mode: "sim", seed: 1337 }), https = false) {
  const app = createApp({ topology: topology({ web: { modules: ["app"], adapter: "node" } }), routes, ctx });
  return { ctx, app, base: https ? "https://localhost" : BASE };
}

/** A client with its own `keel-caller` jar, sending runtime JSON requests. */
function client(built: ReturnType<typeof build>) {
  let jar = "";
  const send = async (method: string, path: string, body?: unknown, accept = "application/json") => {
    const headers = new Headers({ accept });
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

const saved = async (ctx: Ctx): Promise<unknown> => {
  const raw = await ctx.storage.get(KEY);
  return raw === null ? null : JSON.parse(raw);
};

describe("server state (RFC 0044)", () => {
  it("persists `snapshot({ meta: true })` under keel.store.<id>; the caller's id, never its token, rides on the entry", async () => {
    const built = build();
    const a = client(built);
    expect((await a.write("a1")).status).toBe(200);
    const token = a.cookie().slice("keel-caller=".length);
    expect(await saved(built.ctx)).toMatchObject({
      state: { items: ["a1"] },
      initial: { items: [] },
      log: [
        {
          name: "test.add",
          payload: { text: "a1" },
          meta: { caller: createHash("sha256").update(token).digest("base64url") },
        },
      ],
    });
    // Backlog 0131: the stored snapshot never holds the cookie token.
    expect(await built.ctx.storage.get(KEY)).not.toContain(token);
  });

  it("issues the signed caller cookie on a first write only; __Host- and Secure over https (RFC 0057)", async () => {
    const c = client(build());
    expect((await c.send("GET", "/notes")).headers.get("set-cookie")).toBeNull();
    expect((await c.write("a")).headers.get("set-cookie")).toMatch(
      /^keel-caller=[A-Za-z0-9-]{16,64}\.[\w-]{43}; Path=\/; HttpOnly; SameSite=Lax$/,
    );
    expect((await c.write("b")).headers.get("set-cookie")).toBeNull();
    const secure = await client(build(undefined, true)).write("c");
    expect(secure.headers.get("set-cookie")).toMatch(
      /^__Host-keel-caller=[^;]+; Path=\/; HttpOnly; SameSite=Lax; Secure$/,
    );
  });

  it("two interleaving clients each undo only their own last write, across requests and after an await", async () => {
    const built = build();
    const a = client(built);
    const b = client(built);
    expect((await a.write("a1")).status).toBe(200);
    expect((await b.send("PUT", "/notes", { text: "b1" })).status).toBe(200);
    expect(a.cookie()).not.toBe(b.cookie());
    expect(await a.view()).toEqual({ items: ["a1", "b1"], canUndo: false });
    expect(await b.view()).toEqual({ items: ["a1", "b1"], canUndo: true });
    const refused = await a.undo();
    expect([refused.status, (await refused.json()).error.code]).toEqual([403, "keel.denied"]);
    expect((await b.undo()).status).toBe(200);
    expect((await b.undo()).status).toBe(403);
    expect(await a.view()).toEqual({ items: ["a1"], canUndo: true });
    expect((await a.undo()).status).toBe(200);
    expect(await saved(built.ctx)).toMatchObject({ state: { items: [] }, log: [] });
  });

  it("a cookieless, forged or malformed caller undoes nothing", async () => {
    const built = build();
    const a = client(built);
    await a.write("a1");
    const app = await built.app;
    // RFC 0057: a's own token without its signature (a pre-0057 cookie), or with one character of it changed, is no caller.
    const mine = a.cookie();
    const flipped = `${mine.slice(0, -1)}${mine.endsWith("A") ? "B" : "A"}`;
    const unsigned = mine.slice(0, mine.lastIndexOf("."));
    const forged = [
      "keel-caller=00000000-0000-4000-8000-000000000000",
      "keel-caller=<x>",
      "keel-caller=",
      unsigned,
      flipped,
    ];
    for (const cookie of ["", ...forged]) {
      const headers = new Headers({ accept: "application/json", "content-type": "application/json" });
      if (cookie !== "") headers.set("cookie", cookie);
      expect((await app.fetch(new Request(`${BASE}/undo`, { method: "POST", headers, body: "{}" }))).status).toBe(403);
    }
    expect((await a.undo()).status).toBe(200);
  });

  it("factory stores never reach #k-state, whatever the number of writes", async () => {
    const built = build();
    const c = client(built);
    for (let i = 0; i < 20; i++) expect((await c.write(`n${i}`)).status).toBe(200);
    const html = await (await c.send("GET", "/notes", undefined, "text/html")).text();
    expect(html).toContain('"stores":{}');
    expect(html).not.toContain("test.add");
  });

  it("an action's err saves nothing and the 422 re-render reads storage, not the unsaved instance", async () => {
    const built = build();
    const c = client(built);
    await c.write("kept");
    const before = await built.ctx.storage.get(KEY);
    const res = await c.send("PATCH", "/notes", { text: "dropped" });
    expect(res.status).toBe(422);
    expect(await built.ctx.storage.get(KEY)).toBe(before);
    const form = new FormData();
    form.set("_method", "PATCH");
    form.set("text", "dropped");
    const app = await built.app;
    const html = await (await app.fetch(new Request(`${BASE}/notes`, { method: "POST", body: form }))).text();
    expect(html).toContain("kept");
    expect(html).not.toMatch(/kept(&quot;|")\s*,\s*(&quot;|")dropped/);
  });

  it("a factory store with a default id, or a stored snapshot that does not restore, is 500", async () => {
    const built = build();
    const anon = await (await built.app).fetch(
      new Request(`${BASE}/anon`, { headers: { accept: "application/json" } }),
    );
    expect(anon.status).toBe(500);
    await built.ctx.storage.set(KEY, JSON.stringify({ state: { items: [1] }, log: [], initial: { items: [] } }));
    expect((await client(built).send("GET", "/notes")).status).toBe(500);
  });
});
