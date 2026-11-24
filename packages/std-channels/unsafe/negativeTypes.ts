// Type-only fixture (in unsafe/ because it needs expected-error directives): checked by tsc, never run. The run-time
// halves of these cases are asserted in test/channelRouteContract.test.ts, which calls channelRoute untyped.
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { store } from "@keel/store";
import { channel } from "../src/channel.ts";
import { channelRoute } from "../src/server/channelRoute.ts";
import { unsafe } from "./unsafe.ts";

export function negativeTypes(): void {
  unsafe(
    "type-level negatives: each expected-error line asserts the channel builders reject a misuse; checked by tsc, never run",
    () => {
      const flags = () => ({ flag: store(s.object({ on: s.boolean() }), { on: true }, { id: "chat.flag" }) });
      const Room = s.object({ room: s.string() });
      const Ticks = s.object({});
      const room = channel("chat.room", {
        path: "/api/chat/events",
        params: Room,
        message: s.object({ text: s.string() }),
      });
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
      const bare = contract("chat", { "chat.board": { method: "GET", path: "/api/chat/board", output: Board } });

      // @ts-expect-error the contract holds no channel entries at chat.room and chat.post
      channelRoute(bare, room, { id: "chat.room", publish: "chat.post", stores: flags, member });
      // @ts-expect-error a channel with `message` requires `publish`; at runtime the stream's loader alone
      channelRoute(chat, room, { id: "chat.room", stores: flags, member });
      // @ts-expect-error a channel without `message` refuses `publish`
      channelRoute(chat, ticks, { id: "chat.ticks", publish: "chat.post", stores: flags, member: () => true });
    },
  );
}
