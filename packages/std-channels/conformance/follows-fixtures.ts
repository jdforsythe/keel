// Shared fixtures for the rfc:0192 std.channels conformance files (not a test file). Seed 1337.
// Assumption: the seam is structural (std.channels: "a data capability accessor whose object has `follow(channel, key, on)`"), so the followed capability is a fake registered with `register` from `@keel/ctx`, whose object has `follow`, plus `changed` and `lose` that a test calls to play the part of std.postgres.
// Assumption: the route calls `follow(channel, key, on)` with `key` either the canonical JSON text of the stream's params or the params; the fake matches on either.
// Assumption: `channelRoute(chan, roomChannel, { ..., follows: [fake] })` is typed once the build lands; the options are called through `Reflect.apply` so this file compiles before.
import { register } from "@keel/ctx";
import type { SimCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import { channelRoute } from "@keel/std-channels/server";
import { Room, roomChannel, openStream, simCtx } from "./fixtures.ts";
import type { Fetcher, Stream } from "./fixtures.ts";

export type FollowEvent = { kind: "changed" } | { kind: "lost" };
type Listener = { name: string; key: string; on: (e: FollowEvent) => void };

const canonical = (v: unknown): string => {
  if (typeof v === "string") return v;
  const o = typeof v === "object" && v !== null ? v : {};
  return JSON.stringify(Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))));
};

export interface Followable {
  follow(channel: { name: string }, key: unknown, on: (e: FollowEvent) => void): Promise<() => void>;
  /** Reports a committed change of the channel name and params to each matching follow. */
  changed(channel: { name: string }, params: unknown): void;
  /** Reports `lost` once to every open follow, as a lost listen connection does. */
  lose(): void;
  readonly follows: number;
}

function makeFake(): Followable {
  const open = new Set<Listener>();
  return {
    follow: async (channel, key, on) => {
      const l = { name: channel.name, key: canonical(key), on };
      open.add(l);
      return () => {
        open.delete(l);
      };
    },
    changed(channel, params) {
      for (const l of [...open]) if (l.name === channel.name && l.key === canonical(params)) l.on({ kind: "changed" });
    },
    lose() {
      for (const l of [...open]) {
        open.delete(l);
        l.on({ kind: "lost" });
      }
    },
    get follows() {
      return open.size;
    },
  };
}

/** The accessor; the capability name is the one `register` is given. */
export const fakeDb = register<Followable>("chan.fakeDb", { real: makeFake, shell: makeFake, sim: makeFake });

export interface Following {
  readonly ctx: SimCtx;
  readonly app: Fetcher;
  readonly db: Followable;
  /** Whether `member` answers true; set false to make the next re-run refuse. */
  readonly allow: { value: boolean };
  open(room: string): Promise<Stream>;
  dispose(): Promise<void>;
}

/** An app whose one channel route follows `fakeDb`; `member` answers `allow.value`. */
export async function serveFollowing(): Promise<Following> {
  const ctx = simCtx();
  const allow = { value: true };
  const chan = contract("chan", {
    "chan.room": { method: "GET", path: "/api/room/events", query: Room, events: true, output: roomChannel.events },
    "chan.publish": {
      method: "POST",
      path: "/api/room/events",
      query: Room,
      body: roomChannel.body,
      output: s.object({}),
    },
  });
  const options = {
    id: "chan.room",
    publish: "chan.publish",
    follows: [fakeDb],
    member: () => allow.value,
  };
  // `follows` is not in the options type yet: the call goes through `Reflect.apply`; the builder may call `channelRoute(chan, roomChannel, options)` directly.
  const room = Reflect.apply(channelRoute, undefined, [chan, roomChannel, options]);
  const routes = manifest(chan, { "chan.room": { loader: room.loader }, "chan.publish": { action: room.action } });
  const app = await createApp({
    topology: topology({ web: { modules: ["chan"], adapter: "node" } }),
    routes,
    ctx,
    mode: "dev",
  });
  return {
    ctx,
    app,
    db: fakeDb(ctx),
    allow,
    open: (room) => openStream(app, room),
    dispose: async () => {
      const close: unknown = Reflect.get(Object(app), "close");
      if (typeof close === "function") await Reflect.apply(close, app, []);
    },
  };
}
