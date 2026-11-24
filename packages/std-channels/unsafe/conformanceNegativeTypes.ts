// Type-only fixture for conformance/contract-entries.test.ts (in unsafe/ because it needs expected-error directives):
// checked by tsc, never run. The conformance file makes the same calls untyped.
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { channel } from "@keel/std-channels";
import { channelRoute } from "@keel/std-channels/server";
import { store, transaction } from "@keel/store";
import { unsafe } from "./unsafe.ts";

export function conformanceNegativeTypes(): void {
  unsafe(
    "type-level negatives: each expected-error line asserts the channel API rejects a misuse; checked by tsc, never run",
    () => {
      const Room = s.object({ room: s.string() });
      const Msg = s.object({ text: s.string() });
      const Other = s.object({ other: s.string() });
      const Nothing = s.object({});
      const ch = channel("a.room", { path: "/api/a/events", params: Room, message: Msg });
      const plain = channel("a.plain", { path: "/api/a/plain", params: Room });
      const stores = () => {
        const log = store(s.object({ n: s.int() }), { n: 0 }, { id: "a.log" });
        return { log, bump: transaction(log, "a.bump", s.object({}), (st) => ({ n: st.n + 1 })) };
      };
      const member = () => true;
      const pub = { method: "POST", path: "/api/a/events", query: Room, body: ch.body, output: Nothing } as const;
      const ev = { method: "GET", path: "/api/a/events", query: Room, events: true, output: ch.events } as const;

      const good = () => contract("a", { "a.ev": ev, "a.pub": pub });
      const bind = (a: ReturnType<typeof good>) => () =>
        channelRoute(a, ch, { id: "a.ev", publish: "a.pub", stores, member });
      const path = contract("a", {
        "a.ev": { method: "GET", path: "/api/a/other", query: Room, events: true, output: ch.events },
        "a.pub": pub,
      });
      // @ts-expect-error `a.ev` has another `path`
      bind(path);
      const query = contract("a", { "a.ev": { ...ev, query: Other }, "a.pub": pub });
      // @ts-expect-error `a.ev` has another `query`
      bind(query);
      const output = contract("a", { "a.ev": { ...ev, output: Nothing }, "a.pub": pub });
      // @ts-expect-error `a.ev` has another `output`
      bind(output);
      const body = contract("a", { "a.ev": ev, "a.pub": { ...pub, body: Nothing } });
      // @ts-expect-error `a.pub` has another `body`
      bind(body);
      const method = contract("a", {
        "a.ev": { method: "PUT", path: "/api/a/events", query: Room, body: ch.body, output: ch.events },
        "a.pub": pub,
      });
      // @ts-expect-error `a.ev` has another `method`
      bind(method);
      const noEvents = contract("a", {
        "a.ev": { method: "GET", path: "/api/a/events", query: Room, output: ch.events },
        "a.pub": pub,
      });
      // @ts-expect-error `a.ev` is not an `events: true` entry
      bind(noEvents);
      const both = contract("a", {
        "a.ev": { method: "GET", path: "/api/a/other", query: Other, events: true, output: ch.events },
        "a.pub": pub,
      });
      // @ts-expect-error `a.ev` has another `path` and `query`
      bind(both);

      const whole = good();
      // @ts-expect-error a channel with `message` needs `publish`
      channelRoute(whole, ch, { id: "a.ev", stores, member });
      const plainContract = contract("a", {
        "a.ev": { method: "GET", path: "/api/a/plain", query: Room, events: true, output: plain.events },
        "a.pub": { method: "POST", path: "/api/a/plain", query: Room, body: Nothing, output: Nothing },
      });
      // @ts-expect-error a channel without `message` takes no `publish`
      channelRoute(plainContract, plain, { id: "a.ev", publish: "a.pub", stores, member });
    },
  );
}
