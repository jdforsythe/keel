// The board channel's event stream, served by the `api` deployable: every caller is a member.
import { createCtx } from "@keel/ctx";
import { createApp } from "@keel/server";
import { afterEach, describe, expect, it } from "vitest";
import { boardEvents } from "../modules/api/boardEvents.server.ts";
import { runners } from "../modules/api/runners.server.ts";
import topology from "../topology.ts";
import { apiRoutes } from "./apiRoutes.ts";
import { boardOf } from "./at.ts";
import { SECRET, apiApp, resetApi, seedBoard } from "./simApi.ts";
import { write } from "./write.ts";

const open: { close(): Promise<void> }[] = [];
afterEach(async () => {
  for (const app of open.splice(0)) await app.close();
  resetApi();
});

const ORIGIN = "http://localhost";

/** The `data:` payloads of an event stream, read one at a time. */
function dataLines(res: Response) {
  const reader = res.body?.getReader();
  const dec = new TextDecoder();
  let buf = "";
  return async (): Promise<unknown> => {
    for (;;) {
      const line = /^data: (.*)$/m.exec(buf);
      if (line !== null) {
        buf = buf.slice(line.index + line[0].length);
        return JSON.parse(line[1] ?? "null");
      }
      const r = await reader?.read();
      if (r === undefined || r.done) return undefined;
      buf += dec.decode(r.value);
    }
  };
}

describe("boardEvents", () => {
  it("is the api.boardEvents route at the board channel's path", () => {
    expect([boardEvents.id, boardEvents.path]).toEqual(["api.boardEvents", "/api/board/events"]);
  });
  it("opens for a caller with no cookie: reset first, then saved after another caller's write", async () => {
    await seedBoard(boardOf({ lists: [{ id: "l1", name: "Home" }], todos: [] }));
    const app = await apiApp();
    open.push(app);
    const res = await app.fetch(
      new Request(`${ORIGIN}${boardEvents.path}`, { headers: { accept: "text/event-stream" } }),
    );
    expect(res.status).toBe(200);
    const next = dataLines(res);
    expect(await next()).toEqual({ ok: true, value: { kind: "reset" } });
    const post = await app.fetch(
      new Request(`${ORIGIN}/api/lists`, {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json", "x-keel": "1" },
        body: JSON.stringify({ name: "Work", write: write("w1", 0) }),
      }),
    );
    expect(post.status).toBe(200);
    expect(await next()).toEqual({ ok: true, value: { kind: "saved", store: "api.board", head: 1 } });
  });
  it("tells a subscriber of a save that touches only api.removal", async () => {
    const ctx = createCtx({ mode: "sim", seed: 5 });
    const state = boardOf({ lists: [{ id: "l1", name: "Home" }], todos: [] });
    await ctx.storage.set("keel.store.api.board", JSON.stringify({ state, log: [], initial: state }));
    const app = await createApp({
      topology,
      routes: apiRoutes,
      ctx,
      deployable: "api",
      secret: SECRET,
      runners: { api: runners },
    });
    open.push(app);
    const post = await app.fetch(
      new Request(`${ORIGIN}/api/lists/l1/remove`, {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json", "x-keel": "1" },
        body: "{}",
      }),
    );
    expect(post.status).toBe(200);
    const res = await app.fetch(
      new Request(`${ORIGIN}${boardEvents.path}`, { headers: { accept: "text/event-stream" } }),
    );
    const next = dataLines(res);
    expect(await next()).toEqual({ ok: true, value: { kind: "reset" } });
    // The wait ends: the instance leaves `hidden` in a save of `api.removal` alone.
    for (let t = 0; t < 601_000; t += 1000) {
      ctx.clock.advance(1000);
      for (let i = 0; i < 400; i++) await Promise.resolve();
    }
    const stores: unknown[] = [];
    for (let i = 0; i < 6 && !stores.includes("api.removal"); i++) {
      const event = await next();
      stores.push(Reflect.get(Object(Reflect.get(Object(event), "value")), "store"));
    }
    expect(stores).toContain("api.removal");
  });
});
