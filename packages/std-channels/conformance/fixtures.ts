// Shared fixtures for std.channels conformance (not a test file). Property seed: 1337.
// Assumptions (the spec is silent, each is an ordinary reading of k.server / k.api / k.module):
// - the channel route is listed in a manifest as `{ api: true, path, loader }` with `routes.actions({ id: route.actions })`;
// - params travel as the stream URL's search (`?room=a`) and a publish POSTs to the same path and search;
// - module `std` config reaches `createApp({ std })` as a file `{ data, hash }` from `stdArtifact` (as std.jobs does);
// - writes in tests carry `origin`, `accept: application/json` and `x-keel: 1` (the k.server same-site proof);
// - a response's caller cookie is `keel-caller` over http.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stdArtifact } from "@keel/compiler";
import { createCtx } from "@keel/ctx";
import type { SimCtx } from "@keel/ctx";
import { action, manifest } from "@keel/router";
import { ok, s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import { channel } from "@keel/std-channels";
import { channelRoute } from "@keel/std-channels/server";
import { store, transaction, tx } from "@keel/store";

export const SEED = 1337;
export const BASE = "http://localhost";
export const ORIGIN = "http://app.test";

export const Msg = s.object({ text: s.string() });
export const Room = s.object({ room: s.string() });
export const roomChannel = channel("chan.room", { path: "/api/room/events", params: Room, message: Msg });

const Nothing = s.object({});
const Ids = s.object({ ids: s.array(s.string()) });
const Counter = s.object({ n: s.int() });
const Texts = s.object({ items: s.array(s.string()) });

/** The stores the channel creates: `chan.members`, `chan.log`, `chan.notes`. */
const factory = () => {
  const members = store(Ids, { ids: [] }, { id: "chan.members" });
  const log = store(Counter, { n: 0 }, { id: "chan.log" });
  const notes = store(Texts, { items: [] }, { id: "chan.notes" });
  const join = transaction(members, "chan.join", s.object({ id: s.string() }), (st, { id }) => ({
    ids: [...st.ids, id],
  }));
  const leave = transaction(members, "chan.leave", s.object({ id: s.string() }), (st, { id }) => ({
    ids: st.ids.filter((x) => x !== id),
  }));
  const bump = transaction(log, "chan.bump", Nothing, (st) => ({ n: st.n + 1 }));
  const note = transaction(notes, "chan.note", s.object({ text: s.string() }), (st, { text }) => ({
    items: [...st.items, text],
  }));
  return { members, log, notes, join, leave, bump, note };
};

/** A store the channel does not create. */
const otherFactory = () => {
  const other = store(Counter, { n: 0 }, { id: "chan.other" });
  const bump = transaction(other, "chan.other.bump", Nothing, (st) => ({ n: st.n + 1 }));
  return { other, bump };
};

export type Op = "bump" | "note" | "other";

export const simCtx = (): SimCtx => createCtx({ mode: "sim", seed: SEED });

export async function waitFor(pred: () => boolean): Promise<void> {
  for (let i = 0; i < 2000; i++) {
    if (pred()) return;
    await new Promise<void>((r) => setImmediate(r));
  }
  throw new Error("waitFor: condition not reached");
}

export async function settle(turns = 25): Promise<void> {
  for (let i = 0; i < turns; i++) await new Promise<void>((r) => setImmediate(r));
}

export const field = (v: unknown, k: string): unknown =>
  typeof v === "object" && v !== null ? Reflect.get(v, k) : undefined;

export interface Stream {
  readonly status: number;
  readonly headers: Headers;
  /** Every event delivered, in order (the `value` of each `ok` data line). */
  readonly events: unknown[];
  raw(): string;
  ended(): boolean;
  close(): void;
}

export interface Fetcher {
  fetch(req: Request): Promise<Response>;
}

async function pump(res: Response, events: unknown[], raw: { text: string }, done: { ended: boolean }): Promise<void> {
  const reader = res.body?.getReader();
  if (reader === undefined) {
    done.ended = true;
    return;
  }
  const dec = new TextDecoder();
  let buf = "";
  try {
    for (;;) {
      const r = await reader.read();
      if (r.done) break;
      const chunk = dec.decode(r.value, { stream: true });
      raw.text += chunk;
      buf += chunk;
      const cut = buf.lastIndexOf("\n");
      if (cut < 0) continue;
      const lines = buf.slice(0, cut).split("\n");
      buf = buf.slice(cut + 1);
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const parsed: unknown = JSON.parse(line.slice(5));
        events.push(field(parsed, "ok") === true ? field(parsed, "value") : parsed);
      }
    }
  } catch {
    // an aborted request ends the pump
  }
  done.ended = true;
}

export async function openStream(app: Fetcher, room: string, cookie?: string, base = BASE): Promise<Stream> {
  const ac = new AbortController();
  const res = await app.fetch(
    new Request(`${base}${roomChannel.path}?room=${encodeURIComponent(room)}`, {
      headers: { accept: "text/event-stream", ...(cookie === undefined ? {} : { cookie }) },
      signal: ac.signal,
    }),
  );
  const events: unknown[] = [];
  const raw = { text: "" };
  const done = { ended: false };
  void pump(res, events, raw, done);
  return {
    status: res.status,
    headers: res.headers,
    events,
    raw: () => raw.text,
    ended: () => done.ended,
    close: () => ac.abort(),
  };
}

export interface ServeOptions {
  /** Replaces the default membership (the caller is in `chan.members`). */
  readonly member?: (caller: string) => boolean;
  readonly perCaller?: number;
}

export interface Harness {
  readonly ctx: SimCtx;
  readonly app: Fetcher;
  /** The `caller` each `member` call saw, in order. */
  readonly seen: string[];
  post(
    path: string,
    body: unknown,
    o?: { cookie?: string; headers?: Record<string, string>; search?: string },
  ): Promise<Response>;
  /** A fresh cookie that is not a member. */
  mint(): Promise<string>;
  /** A fresh cookie whose caller joined `chan.members`. */
  enroll(): Promise<string>;
  /** Removes the cookie's caller from `chan.members`. */
  leave(cookie: string): Promise<void>;
  act(op: Op, cookie?: string): Promise<void>;
  open(room: string, cookie?: string): Promise<Stream>;
  dispose(): Promise<void>;
}

const cookieOf = (res: Response): string => {
  const header = res.headers.get("set-cookie");
  if (header === null) throw new Error("no caller cookie was set");
  return header.split(";")[0] ?? "";
};

export async function serve(o: ServeOptions = {}): Promise<Harness> {
  const ctx = simCtx();
  const seen: string[] = [];
  const route = channelRoute(roomChannel, {
    id: "chan.room",
    stores: factory,
    member: ({ caller, stores }) => {
      seen.push(caller);
      return o.member === undefined ? stores.members.get("ids").includes(caller) : o.member(caller);
    },
  });
  const join = action({ input: Nothing, stores: factory }, async (_i, { caller, stores }) => {
    tx(stores.join, { id: caller });
    return ok(null);
  });
  const leave = action({ input: Nothing, stores: factory }, async (_i, { caller, stores }) => {
    tx(stores.leave, { id: caller });
    return ok(null);
  });
  const bump = action({ input: Nothing, stores: factory }, async (_i, { stores }) => {
    tx(stores.bump, {});
    return ok(null);
  });
  const note = action({ input: s.object({ text: s.string() }), stores: factory }, async ({ text }, { stores }) => {
    tx(stores.note, { text });
    return ok(null);
  });
  const other = action({ input: Nothing, stores: otherFactory }, async (_i, { stores }) => {
    tx(stores.bump, {});
    return ok(null);
  });
  const noop = action({ input: Nothing }, async () => ok(null));
  const routes = manifest({
    "chan.room": { api: true, path: route.path, loader: route.loader },
    "chan.join": { api: true, path: "/api/join" },
    "chan.leave": { api: true, path: "/api/leave" },
    "chan.bump": { api: true, path: "/api/bump" },
    "chan.note": { api: true, path: "/api/note" },
    "chan.other": { api: true, path: "/api/other" },
    "chan.noop": { api: true, path: "/api/noop" },
  });
  routes.actions({
    "chan.room": route.actions,
    "chan.join": { POST: join },
    "chan.leave": { POST: leave },
    "chan.bump": { POST: bump },
    "chan.note": { POST: note },
    "chan.other": { POST: other },
    "chan.noop": { POST: noop },
  });
  const dir = mkdtempSync(join(tmpdir(), "keel-channels-"));
  let std: string | undefined;
  if (o.perCaller !== undefined) {
    std = join(dir, "std.json");
    const { data, hash } = stdArtifact([
      {
        path: "modules/chan/module.ts",
        source: `import { module } from "@keel/compiler"\nexport default module({ id: "chan", deps: ["@keel/std-channels"], capabilities: ["clock", "net", "observe"], std: { "@keel/std-channels": { perCaller: ${o.perCaller} } } })\n`,
      },
    ]);
    writeFileSync(std, JSON.stringify({ data, hash }));
  }
  const app = await createApp({
    topology: topology({ web: { modules: ["chan"], adapter: "node" } }),
    routes,
    ctx,
    mode: "dev",
    ...(std === undefined ? {} : { std }),
  });
  const post: Harness["post"] = (path, body, opt = {}) =>
    app.fetch(
      new Request(`${BASE}${path}${opt.search ?? ""}`, {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "x-keel": "1",
          origin: BASE,
          ...(opt.cookie === undefined ? {} : { cookie: opt.cookie }),
          ...opt.headers,
        },
      }),
    );
  const paths: Record<Op, string> = { bump: "/api/bump", note: "/api/note", other: "/api/other" };
  return {
    ctx,
    app,
    seen,
    post,
    mint: async () => cookieOf(await post("/api/noop", {})),
    enroll: async () => cookieOf(await post("/api/join", {})),
    leave: async (cookie) => {
      const res = await post("/api/leave", {}, { cookie });
      if (res.status !== 200) throw new Error(`leave answered ${res.status}`);
    },
    act: async (op, cookie) => {
      const res = await post(paths[op], op === "note" ? { text: "n" } : {}, cookie === undefined ? {} : { cookie });
      if (res.status !== 200) throw new Error(`${op} answered ${res.status}`);
    },
    open: (room, cookie) => openStream(app, room, cookie),
    dispose: async () => {
      const close: unknown = Reflect.get(Object(app), "close");
      if (typeof close === "function") await Reflect.apply(close, app, []);
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

const enc = new TextEncoder();
export const sseLine = (event: unknown): Uint8Array =>
  enc.encode(`data: ${JSON.stringify({ ok: true, value: event })}\n\n`);

export interface Seen {
  readonly at: number;
  readonly url: string;
  readonly signal: AbortSignal;
}

/** A scripted server on a sim ctx's net: records each request and answers by `mode`. */
export function scripted(ctx: SimCtx, origin = ORIGIN) {
  const requests: Seen[] = [];
  const state: { mode: "reject" | "empty" | "hold" } = { mode: "hold" };
  let current: ReadableStreamDefaultController<Uint8Array> | undefined;
  ctx.net.route(`${origin}/*`, (req) => {
    requests.push({ at: ctx.clock.now(), url: req.url, signal: req.signal });
    if (state.mode === "reject") return Promise.reject(new TypeError("network"));
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        if (state.mode === "empty") c.close();
        else current = c;
      },
    });
    return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
  });
  return {
    requests,
    state,
    send(event: unknown): void {
      try {
        current?.enqueue(sseLine(event));
      } catch {
        // the stream was closed or aborted
      }
    },
    end(): void {
      try {
        current?.close();
      } catch {
        // already closed
      }
    },
  };
}
