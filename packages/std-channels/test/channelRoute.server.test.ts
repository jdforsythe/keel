import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stdArtifact } from "@keel/compiler";
import { createCtx } from "@keel/ctx";
import { report } from "@keel/ctx/internal";
import { scope } from "@keel/reactive";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import { store } from "@keel/store";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterEach, expect, test } from "vitest";
import { channel } from "../src/channel.ts";
import { channelRoute } from "../src/server/channelRoute.server.ts";
import { hubOf } from "../src/server/internal/hubOf.ts";

const BASE = "http://localhost";
const Flag = s.object({ on: s.boolean() });
const flags = () => ({ flag: store(Flag, { on: true }, { id: "t.flag" }) });
const room = channel("t.room", {
  path: "/api/room/events",
  params: s.object({ room: s.string() }),
  message: s.object({ text: s.string() }),
});
const t = contract("t", {
  "t.room": { method: "GET", path: "/api/room/events", query: room.params, events: true, output: room.events },
  "t.publish": { method: "POST", path: "/api/room/events", query: room.params, body: room.body, output: s.object({}) },
});
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const turn = () => new Promise<void>((r) => setImmediate(r));
async function until(pred: () => boolean): Promise<void> {
  for (let i = 0; i < 2000 && !pred(); i++) await turn();
  if (!pred()) throw new Error("condition not reached");
}

async function serve(
  member: (at: { caller: string; stores: ReturnType<typeof flags> }) => boolean,
  maxStreams?: number,
) {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const route = channelRoute(t, room, { id: "t.room", publish: "t.publish", stores: flags, member });
  const routes = manifest(t, { "t.room": { loader: route.loader }, "t.publish": { action: route.action } });
  let std: string | undefined;
  if (maxStreams !== undefined) {
    const dir = tempDir("keel-channels-unit-");
    dirs.push(dir);
    std = join(dir, "std.json");
    const source = `import { module } from "@keel/compiler"\nexport default module({ id: "t", deps: ["@keel/std-channels"], capabilities: ["clock", "net", "observe"], std: { "@keel/std-channels": { maxStreams: ${maxStreams} } } })\n`;
    writeFileSync(std, JSON.stringify(stdArtifact([{ path: "modules/t/module.ts", source }])));
  }
  const app = await createApp({
    topology: topology({ web: { modules: ["t"], adapter: "node" } }),
    routes,
    ctx,
    mode: "dev",
    ...(std === undefined ? {} : { std }),
  });
  const open = async (search: string, cookie?: string) => {
    const ac = new AbortController();
    const res = await app.fetch(
      new Request(`${BASE}${room.path}${search}`, {
        headers: { accept: "text/event-stream", ...(cookie === undefined ? {} : { cookie }) },
        signal: ac.signal,
      }),
    );
    const lines: unknown[] = [];
    const state = { ended: false };
    void (async () => {
      const reader = res.body?.getReader();
      const dec = new TextDecoder();
      try {
        for (let r = await reader?.read(); r !== undefined && !r.done; r = await reader?.read())
          for (const l of dec.decode(r.value).split("\n"))
            if (l.startsWith("data:")) lines.push(JSON.parse(l.slice(5)));
      } catch {
        // aborted
      }
      state.ended = true;
    })();
    return { lines, ended: () => state.ended, close: () => ac.abort() };
  };
  const post = (search: string, body: unknown) =>
    app.fetch(
      new Request(`${BASE}${room.path}${search}`, {
        method: "POST",
        body: JSON.stringify(body),
        headers: { accept: "application/json", "content-type": "application/json", "x-keel": "1", origin: BASE },
      }),
    );
  return { ctx, open, post, fetch: (req: Request) => app.fetch(req) };
}

test("member is re-checked against the stores as saved when the server ctx reports a save of one of them", async () => {
  const h = await serve(({ stores }) => stores.flag.get("on"));
  const st = await h.open("?room=a");
  await until(() => st.lines.length === 1);
  const copy = scope(() => undefined).run(() => store(Flag, { on: true }, { id: "t.copy" }));
  await h.ctx.storage.set("keel.store.t.flag", JSON.stringify(copy.snapshot({ meta: true })));
  report(h.ctx, { kind: "save", store: "t.other", head: 1, from: 0 });
  report(h.ctx, { kind: "save", store: "t.flag", head: 1, from: 0 });
  await until(() => st.lines.length === 2);
  const offState = { ...copy.snapshot({ meta: true }), state: { on: false } };
  await h.ctx.storage.set("keel.store.t.flag", JSON.stringify(offState));
  report(h.ctx, { kind: "save", store: "t.flag", head: 2, from: 1 });
  await until(() => st.ended());
  expect(st.lines).toEqual([
    { ok: true, value: { kind: "reset" } },
    { ok: true, value: { kind: "saved", store: "t.flag", head: 1 } },
    { ok: true, value: { kind: "closed", reason: "denied" } },
  ]);
});

test("a store whose head restarts lower gives the stream a reset, then its saves again", async () => {
  const h = await serve(() => true);
  const st = await h.open("?room=a");
  await until(() => st.lines.length === 1);
  const copy = scope(() => undefined).run(() => store(Flag, { on: true }, { id: "t.copy2" }));
  await h.ctx.storage.set("keel.store.t.flag", JSON.stringify(copy.snapshot({ meta: true })));
  report(h.ctx, { kind: "save", store: "t.flag", head: 5, from: 4 });
  report(h.ctx, { kind: "save", store: "t.flag", head: 5, from: 4 });
  await until(() => st.lines.length === 2);
  report(h.ctx, { kind: "save", store: "t.flag", head: 1, from: 0 });
  await until(() => st.lines.length === 3);
  report(h.ctx, { kind: "save", store: "t.flag", head: 2, from: 1 });
  await until(() => st.lines.length === 4);
  expect(st.lines).toEqual([
    { ok: true, value: { kind: "reset" } },
    { ok: true, value: { kind: "saved", store: "t.flag", head: 5 } },
    { ok: true, value: { kind: "reset" } },
    { ok: true, value: { kind: "saved", store: "t.flag", head: 2 } },
  ]);
});

test("a member predicate that throws denies, at open and at publish", async () => {
  const h = await serve(() => {
    throw new Error("boom");
  });
  const st = await h.open("?room=a");
  await until(() => st.ended());
  expect(st.lines).toEqual([{ ok: true, value: { kind: "closed", reason: "denied" } }]);
  expect((await h.post("?room=a", { message: { text: "x" } })).status).toBe(403);
});

test("params that fail the channel's schema answer 422 keel.fields, to an open and to a publish, and run no member", async () => {
  let calls = 0;
  const h = await serve(() => {
    calls++;
    return true;
  });
  const opened = await h.fetch(
    new Request(`${BASE}${room.path}?other=1`, { headers: { accept: "text/event-stream" } }),
  );
  expect(opened.status).toBe(422);
  const posted = await h.post("?other=1", { message: { text: "x" } });
  expect(posted.status).toBe(422);
  expect(await posted.text()).toContain("keel.fields");
  expect(calls).toBe(0);
});

test("a publish whose message fails the channel's schema is 422 keel.fields and runs no member", async () => {
  let calls = 0;
  const h = await serve(() => {
    calls++;
    return true;
  });
  const res = await h.post("?room=a", { message: { text: 1 } });
  expect(res.status).toBe(422);
  expect(await res.text()).toContain("keel.fields");
  expect(calls).toBe(0);
});

test("an open past the serving module's maxStreams gets closed full, whatever its caller", async () => {
  const h = await serve(() => true, 2);
  const kept = [await h.open("?room=a"), await h.open("?room=b")];
  await until(() => kept.every((st) => st.lines.length === 1));
  const over = await h.open("?room=c");
  await until(() => over.ended());
  expect(over.lines).toEqual([{ ok: true, value: { kind: "closed", reason: "full" } }]);
  kept[0]?.close();
  await until(() => kept[0]?.ended() === true);
  await turn();
  const again = await h.open("?room=c");
  await until(() => again.lines.length === 1);
  expect(again.lines[0]).toEqual({ ok: true, value: { kind: "reset" } });
  for (const st of [...kept, again]) st.close();
});

test("an open whose caller cookie does not verify counts as cookieless, and a stream that ends gives its place back", async () => {
  const h = await serve(() => true);
  const kept: Awaited<ReturnType<typeof h.open>>[] = [];
  for (let i = 0; i < 64; i++) kept.push(await h.open(`?room=r${i}`));
  await until(() => kept.every((st) => st.lines.length === 1));
  const forged = await h.open("?room=x", "keel-caller=forged.0000");
  await until(() => forged.ended());
  expect(forged.lines).toEqual([{ ok: true, value: { kind: "closed", reason: "full" } }]);
  const first = kept[0];
  first?.close();
  await until(() => first?.ended() === true);
  await turn();
  const again = await h.open("?room=y");
  await until(() => again.lines.length === 1);
  expect(again.lines).toEqual([{ ok: true, value: { kind: "reset" } }]);
  expect(again.ended()).toBe(false);
  for (const st of [...kept, again]) st.close();
});

test("a route whose member refuses caller '' holds no cookieless stream: every cookieless open, past perAnonymous too, is closed denied", async () => {
  const seen: string[] = [];
  const h = await serve(({ caller }) => {
    seen.push(caller);
    return caller !== "";
  });
  const opens: Awaited<ReturnType<typeof h.open>>[] = [];
  for (let i = 0; i < 66; i++) opens.push(await h.open(`?room=r${i}`));
  opens.push(await h.open("?room=x", "keel-caller=forged.0000"));
  await until(() => opens.every((st) => st.ended()));
  for (const st of opens) expect(st.lines).toEqual([{ ok: true, value: { kind: "closed", reason: "denied" } }]);
  expect(hubOf(h.ctx).sinks.size).toBe(0);
  expect(new Set(seen)).toEqual(new Set([""]));
});
