// `channelRoute(contract, channel, opts)` declares its handlers through the serving module's contract, whose entries
// are written out with the channel's own path and schemas: the handlers bind in `manifest` by entry, a contract whose
// entry differs from the channel's is E1515 naming the members, and `publish` is required exactly when the channel
// has `message`. Seed 1337 (fixed fixtures).
import { loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { store } from "@keel/store";
import { expect, test } from "vitest";
import { channel } from "../src/channel.ts";
import { channelRoute } from "../src/server/channelRoute.ts";

const flags = () => ({ flag: store(s.object({ on: s.boolean() }), { on: true }, { id: "chat.flag" }) });
const Room = s.object({ room: s.string() });
const Ticks = s.object({});
const room = channel("chat.room", { path: "/api/chat/events", params: Room, message: s.object({ text: s.string() }) });
const ticks = channel("chat.ticks", { path: "/api/chat/ticks", params: Ticks });
const Board = s.object({ n: s.int() });
const Nothing = s.object({});
const chat = contract("chat", {
  "chat.room": { method: "GET", path: "/api/chat/events", query: Room, events: true, output: room.events },
  "chat.post": { method: "POST", path: "/api/chat/events", query: Room, body: room.body, output: Nothing },
  "chat.ticks": { method: "GET", path: "/api/chat/ticks", query: Ticks, events: true, output: ticks.events },
  "chat.board": { method: "GET", path: "/api/chat/board", output: Board },
});
const member = ({ params }: { readonly params: { readonly room: string } }) => params.room !== "";
const loadBoard = loader(chat, "chat.board", {}, async () => ok({ n: 1 }));
const thrown = (fn: () => unknown): unknown => {
  try {
    fn();
  } catch (e) {
    return typeof e === "object" && e !== null && "code" in e ? [e.code, e instanceof Error ? e.message : ""] : "?";
  }
  return null;
};

test("the handlers are declared through the serving module's contract and bind in its manifest by entry", () => {
  const roomRoute = channelRoute(chat, room, { id: "chat.room", publish: "chat.post", stores: flags, member });
  const tickRoute = channelRoute(chat, ticks, { id: "chat.ticks", stores: flags, member: () => true });
  expect(roomRoute.loader.contract).toBe(chat);
  expect(roomRoute.loader.id).toBe("chat.room");
  expect(roomRoute.action.contract).toBe(chat);
  expect(roomRoute.action.id).toBe("chat.post");
  expect(Object.keys(tickRoute)).toEqual(["loader"]);
  const table = manifest(chat, {
    "chat.room": { loader: roomRoute.loader },
    "chat.post": { action: roomRoute.action },
    "chat.ticks": { loader: tickRoute.loader },
    "chat.board": { loader: loadBoard },
  });
  expect(table.contracts).toEqual([chat]);
});

test("an entry that is not the channel's is E1515 naming each member that differs", () => {
  const run = (c: unknown): unknown =>
    thrown(() =>
      Reflect.apply(channelRoute, undefined, [
        c,
        room,
        { id: "chat.room", publish: "chat.post", stores: flags, member },
      ]),
    );
  const bare = contract("chat", { "chat.board": { method: "GET", path: "/api/chat/board", output: Board } });
  expect(run(bare)).toEqual(["E1515", expect.stringContaining("chat.room is not its channel's, at entry")]);
  const moved = contract("chat", {
    "chat.room": {
      method: "GET",
      path: "/api/chat/other",
      query: s.object({ room: s.string() }),
      events: true,
      output: room.events,
    },
    "chat.post": { method: "POST", path: "/api/chat/events", query: Room, body: room.body, output: Nothing },
  });
  expect(run(moved)).toEqual(["E1515", expect.stringContaining("chat.room is not its channel's, at path, query")]);
  const copied = contract("chat", {
    "chat.room": { method: "GET", path: "/api/chat/events", query: Room, events: true, output: room.events },
    "chat.post": {
      method: "POST",
      path: "/api/chat/events",
      query: Room,
      body: s.object({ message: s.object({ text: s.string() }) }),
      output: s.object({ id: s.string() }),
    },
  });
  expect(run(copied)).toEqual(["E1515", expect.stringContaining("chat.post is not its channel's, at body, output")]);
  expect(run(chat)).toBe(null);
});

test("type errors: entries missing from the contract, a missing publish with message, a publish without", () => {
  // The type errors are in unsafe/negativeTypes.ts; called untyped here.
  const bare = contract("chat", { "chat.board": { method: "GET", path: "/api/chat/board", output: Board } });
  const call = (...args: unknown[]): unknown => Reflect.apply(channelRoute, undefined, args);
  expect(() => call(bare, room, { id: "chat.room", publish: "chat.post", stores: flags, member })).toThrow();
  expect(Object.keys(Object(call(chat, room, { id: "chat.room", stores: flags, member })))).toEqual(["loader"]);
  expect(() =>
    call(chat, ticks, { id: "chat.ticks", publish: "chat.post", stores: flags, member: () => true }),
  ).toThrow();
});

test("a publish on a channel without message is E1510", () => {
  const opts = { id: "chat.ticks", publish: "chat.post", stores: flags, member };
  expect(thrown(() => Reflect.apply(channelRoute, undefined, [chat, ticks, opts]))).toEqual([
    "E1510",
    expect.stringContaining("declares no message"),
  ]);
});
