// Spec: std.channels, clause "A `lost` report ends each following stream with no `closed` event; under sim, `subscribe` reopens 1 s later and the new stream starts with `reset`."
// Seed 1337
// Pending (rfc:0192): skipped until the build lands; the builder un-skips by changing each `test.skip` to `test` in this file.
// Assumption: the `lost` report is the fake's `lose()` (follows-fixtures.ts); `subscribe` runs on the app's own sim ctx, whose net routes the origin to the app.
// Assumption: "no `closed` event" is the stream ending with exactly the events it had before.
import { scope } from "@keel/reactive";
import { subscribe } from "@keel/std-channels";
import { expect, test } from "vitest";
import { ORIGIN, roomChannel, settle, waitFor } from "./fixtures.ts";
import { serveFollowing } from "./follows-fixtures.ts";

test("A `lost` report ends each following stream with no `closed` event", async () => {
  const h = await serveFollowing();
  try {
    const a = await h.open("a");
    const b = await h.open("b");
    await waitFor(() => a.events.length >= 1 && b.events.length >= 1);
    h.db.lose();
    await waitFor(() => a.ended() && b.ended());
    await settle();
    expect(a.events).toEqual([{ kind: "reset" }]);
    expect(b.events).toEqual([{ kind: "reset" }]);
  } finally {
    await h.dispose();
  }
});

test("under sim, `subscribe` reopens 1 s later after a `lost` report and the new stream starts with `reset`", async () => {
  const h = await serveFollowing();
  try {
    h.ctx.net.route(`${ORIGIN}/*`, (req) => h.app.fetch(req));
    const events: unknown[] = [];
    const sc = scope(
      () => {
        subscribe(h.ctx, ORIGIN, roomChannel, { room: "a" }, (e) => {
          events.push(e);
        });
      },
      { detached: true },
    );
    await waitFor(() => events.length >= 1);
    expect(events).toEqual([{ kind: "reset" }]);
    h.db.lose();
    await settle();
    expect(events).toEqual([{ kind: "reset" }]);
    h.ctx.clock.advance(999);
    await settle();
    expect(events).toEqual([{ kind: "reset" }]);
    h.ctx.clock.advance(1);
    await waitFor(() => events.length >= 2);
    expect(events).toEqual([{ kind: "reset" }, { kind: "reset" }]);
    expect(h.db.follows).toBe(1);
    sc.dispose();
  } finally {
    await h.dispose();
  }
});
