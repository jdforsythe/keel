// Shared fixtures for the rfc:0193 std.channels conformance files (not a test file). Seed 1337.
// Assumption: the identity source reads the request's `sid` cookie in `sessions` (a missing session answers `''`); `member` is true for a non-empty `user`; the clock is the sim ctx's, driven by `ctx.clock.advance`.
// Assumption: an identify call "for a stream" is a call whose request accepts `text/event-stream` (the open and each `currentUser()`).
import type { SimCtx } from "@keel/ctx";
import { action, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { createApp, identity, topology } from "@keel/server";
import { channelRoute } from "@keel/std-channels/server";
import { store, transaction, tx } from "@keel/store";
import { BASE, Room, roomChannel, openStream, simCtx } from "./fixtures.ts";
import type { Stream } from "./fixtures.ts";

const Nothing = s.object({});
const Counter = s.object({ n: s.int() });

const factory = () => {
  const log = store(Counter, { n: 0 }, { id: "chan.log" });
  const bump = transaction(log, "chan.bump", Nothing, (st) => ({ n: st.n + 1 }));
  return { log, bump };
};

export type Mode = "answer" | "throw" | "hang";

export interface IdentifyRig {
  readonly ctx: SimCtx;
  /** `sid` cookie value to user id; delete an entry to remove the session. */
  readonly sessions: Map<string, string>;
  /** How `identify` behaves for a `sid`, from now on (default `answer`). */
  readonly modes: Map<string, Mode>;
  /** `identify` calls so far whose request is an event stream, by `sid`. */
  streamCalls(sid: string): number;
  /** `identify` calls so far whose request is not an event stream, by `sid`. */
  otherCalls(sid: string): number;
  open(room: string, sid: string): Promise<Stream>;
  /** A save of the stores the channel creates. */
  bump(sid: string): Promise<void>;
  publish(room: string, sid: string, text: string): Promise<Response>;
  dispose(): Promise<void>;
}

const sidOf = (request: Request): string => {
  const m = /(?:^|;\s*)sid=([^;]*)/.exec(request.headers.get("cookie") ?? "");
  return m?.[1] ?? "";
};

export async function serveIdentified(): Promise<IdentifyRig> {
  const ctx = simCtx();
  const sessions = new Map<string, string>();
  const modes = new Map<string, Mode>();
  const streamed = new Map<string, number>();
  const other = new Map<string, number>();
  const chan = contract("chan", {
    "chan.room": { method: "GET", path: "/api/room/events", query: Room, events: true, output: roomChannel.events },
    "chan.publish": {
      method: "POST",
      path: "/api/room/events",
      query: Room,
      body: roomChannel.body,
      output: s.object({}),
    },
    "chan.bump": { method: "POST", path: "/api/bump", body: Nothing, output: s.object({}) },
  });
  const room = channelRoute(chan, roomChannel, {
    id: "chan.room",
    publish: "chan.publish",
    stores: factory,
    member: ({ user }) => user !== "",
  });
  const bump = action(chan, "chan.bump", { stores: factory }, async (_body, { stores }) => {
    tx(stores.bump, {});
    return ok({});
  });
  const routes = manifest(chan, {
    "chan.room": { loader: room.loader },
    "chan.publish": { action: room.action },
    "chan.bump": { action: bump },
  });
  const app = await createApp({
    topology: topology({ web: { modules: ["chan"], adapter: "node" } }),
    routes,
    ctx,
    mode: "dev",
    identity: identity({
      identify: async ({ request }) => {
        const sid = sidOf(request);
        const book = (request.headers.get("accept") ?? "").includes("text/event-stream") ? streamed : other;
        book.set(sid, (book.get(sid) ?? 0) + 1);
        const mode = modes.get(sid) ?? "answer";
        if (mode === "throw") throw new TypeError("identify-fixture");
        if (mode === "hang") return new Promise<string>(() => undefined);
        return sessions.get(sid) ?? "";
      },
    }),
  });
  const write = (path: string, body: unknown, sid: string) =>
    app.fetch(
      new Request(`${BASE}${path}`, {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "x-keel": "1",
          origin: BASE,
          cookie: `sid=${sid}`,
        },
      }),
    );
  return {
    ctx,
    sessions,
    modes,
    streamCalls: (sid) => streamed.get(sid) ?? 0,
    otherCalls: (sid) => other.get(sid) ?? 0,
    open: (r, sid) => openStream(app, r, `sid=${sid}`),
    bump: async (sid) => {
      const res = await write("/api/bump", {}, sid);
      if (res.status !== 200) throw new Error(`bump answered ${res.status}`);
    },
    publish: (r, sid, text) => write(`/api/room/events?room=${encodeURIComponent(r)}`, { text }, sid),
    dispose: async () => {
      const close: unknown = Reflect.get(Object(app), "close");
      if (typeof close === "function") await Reflect.apply(close, app, []);
    },
  };
}
