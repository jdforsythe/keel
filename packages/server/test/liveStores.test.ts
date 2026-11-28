// @vitest-environment node
// A live API loader's `stores` (k.server Server state, Request flow): the factory's stores stay open for the whole event
// stream, not just until `handle` returns, and its scope is disposed once the stream ends: when `fn` returns, on
// `close()` while a write is stalled on an unread body, and on request abort. Sim ctx, no wall time.
import { createCtx } from "@keel/ctx";
import { owner } from "@keel/reactive";
import { loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { store, transaction, tx } from "@keel/store";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";

const Notes = s.object({ items: s.array(s.string()) });

async function flush(): Promise<void> {
  for (let i = 0; i < 100; i++) await Promise.resolve();
}

/** An app serving `/api/feed`, a live API loader that adds a note per yield (`n` of them, then it waits for `signal`). */
async function feed(n: number) {
  const state = { disposed: false };
  const factory = () => {
    owner()?.onDispose(() => {
      state.disposed = true;
    });
    const notes = store(Notes, { items: [] }, { id: "t.notes" });
    return { notes, add: transaction(notes, "t.add", s.string(), (st, p) => ({ items: [...st.items, p] })) };
  };
  const c = contract("a", {
    "a.feed": { method: "GET", path: "/api/feed", output: s.object({ n: s.int() }), events: true },
  });
  const live = loader(c, "a.feed", { stores: factory }, async function* ({ stores, signal }, ctx) {
    for (let i = 0; i < n; i++) {
      const r = tx(stores.add, `x${i}`);
      yield r.ok ? ok({ n: stores.notes.get("items").length }) : ok({ n: -1 });
    }
    await ctx.clock.after(60_000, signal).catch(() => undefined);
  });
  const ctx = createCtx({ mode: "sim", seed: 1 });
  const app = await createApp({
    topology: topology({ x: { modules: ["a"], adapter: "node" } }),
    routes: manifest(c, { "a.feed": { loader: live } }),
    ctx,
  });
  const ac = new AbortController();
  const res = await app.fetch(
    new Request("http://h/api/feed", { headers: { accept: "text/event-stream" }, signal: ac.signal }),
  );
  return { app, res, state, ac };
}

const lines = (text: string) => text.split("\n").filter((l) => l.startsWith("data:"));

describe("live loader stores", () => {
  it("reads and writes its stores on every yield, after the request returned the stream", async () => {
    const { res, state, app } = await feed(3);
    const reader = res.body?.getReader();
    const dec = new TextDecoder();
    let text = "";
    while (lines(text).length < 3) {
      const r = await reader?.read();
      if (r === undefined || r.done) break;
      text += dec.decode(r.value);
    }
    expect(lines(text)).toEqual([1, 2, 3].map((n) => `data: ${JSON.stringify(ok({ n }))}`));
    expect(state.disposed).toBe(false);
    await app.close();
    await flush();
    expect(state.disposed).toBe(true);
  });

  it("disposes the stream's scope on close() while a write waits on an unread body", async () => {
    const { app, state } = await feed(5);
    await flush();
    expect(state.disposed).toBe(false);
    await app.close();
    await flush();
    expect(state.disposed).toBe(true);
  });

  it("disposes the stream's scope when the request aborts", async () => {
    const { state, ac } = await feed(1);
    await flush();
    expect(state.disposed).toBe(false);
    ac.abort();
    await flush();
    expect(state.disposed).toBe(true);
  });
});
