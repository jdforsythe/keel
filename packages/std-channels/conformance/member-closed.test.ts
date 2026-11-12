// Spec: std.channels, clause "After a save that makes `member` false for an open stream's caller, that stream gets `{ kind: 'closed', reason: 'denied' }` and ends, and the other members' streams continue."
// Seed 1337
import fc from "fast-check";
import { expect, test } from "vitest";
import { type Stream, serve, settle, waitFor } from "./fixtures.ts";

test("After a save that makes `member` false for an open stream's caller, that stream gets `{ kind: 'closed', reason: 'denied' }` and ends, and the other members' streams continue.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 2, max: 4 }), fc.nat(3), async (count, pick) => {
      const gone = pick % count;
      const h = await serve();
      try {
        const cookies: string[] = [];
        for (let i = 0; i < count; i++) cookies.push(await h.enroll());
        const streams: Stream[] = [];
        for (const c of cookies) streams.push(await h.open("r", c));
        await waitFor(() => streams.every((st) => st.events.length >= 1));
        await h.leave(cookies[gone] ?? "");
        const out = streams[gone];
        await waitFor(() => out?.ended() === true);
        await settle();
        expect(out?.events.at(-1)).toEqual({ kind: "closed", reason: "denied" });
        const closedAt = out?.events.length ?? 0;
        await h.act("bump", cookies[(gone + 1) % count]);
        await settle();
        expect(out?.events).toHaveLength(closedAt);
        streams.forEach((st, i) => {
          if (i !== gone) expect(st.ended()).toBe(false);
        });
        for (const [i, st] of streams.entries()) {
          if (i === gone) continue;
          await waitFor(() =>
            st.events.some((e) => JSON.stringify(e) === JSON.stringify({ kind: "saved", store: "chan.log", head: 1 })),
          );
        }
        for (const st of streams) st.close();
      } finally {
        await h.dispose();
      }
    }),
    { seed: 1337, numRuns: 10 },
  );
});
