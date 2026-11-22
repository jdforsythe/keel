// Spec: std.channels, Serve "With `currentUser.fixed` (no identity source) the route asks nothing: no check, clock read or timer on a delivery."
// Seed 1337 (fc.assert below).
// Untestable from the public surface: "no clock read or timer"; only "no check" is observable here, as deliveries that arrive in order and are never closed `denied`, with the sim clock never advanced.
// Assumption: with no identity source the stream's `user` is `''`, so `member` here accepts `''`.
import { action, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import { channelRoute } from "@keel/std-channels/server";
import { store, transaction, tx } from "@keel/store";
import fc from "fast-check";
import { expect, test } from "vitest";
import { Room, roomChannel, openStream, simCtx, waitFor, BASE } from "./fixtures.ts";

const Nothing = s.object({});
const factory = () => {
  const log = store(s.object({ n: s.int() }), { n: 0 }, { id: "chan.log" });
  const bump = transaction(log, "chan.bump", Nothing, (st) => ({ n: st.n + 1 }));
  return { log, bump };
};

test("With `currentUser.fixed` (no identity source) a delivery runs no check: any number of saves each give `saved`, in order, none `denied`, with the clock never advanced", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 5 }), async (n) => {
      const ctx = simCtx();
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
        member: () => true,
      });
      const bump = action(chan, "chan.bump", { stores: factory }, async (_b, { stores }) => {
        tx(stores.bump, {});
        return ok({});
      });
      const app = await createApp({
        topology: topology({ web: { modules: ["chan"], adapter: "node" } }),
        routes: manifest(chan, {
          "chan.room": { loader: room.loader },
          "chan.publish": { action: room.action },
          "chan.bump": { action: bump },
        }),
        ctx,
        mode: "dev",
      });
      try {
        const st = await openStream(app, "r");
        await waitFor(() => st.events.length >= 1);
        for (let i = 0; i < n; i++) {
          const res = await app.fetch(
            new Request(`${BASE}/api/bump`, {
              method: "POST",
              body: "{}",
              headers: { accept: "application/json", "content-type": "application/json", "x-keel": "1", origin: BASE },
            }),
          );
          expect(res.status).toBe(200);
        }
        await waitFor(() => st.events.length >= 1 + n);
        expect(st.events[0]).toEqual({ kind: "reset" });
        expect(st.events.slice(1).every((e) => Reflect.get(Object(e), "kind") === "saved")).toBe(true);
        expect(st.ended()).toBe(false);
        st.close();
      } finally {
        const close: unknown = Reflect.get(Object(app), "close");
        if (typeof close === "function") await Reflect.apply(close, app, []);
      }
    }),
    { seed: 1337, numRuns: 5 },
  );
});
