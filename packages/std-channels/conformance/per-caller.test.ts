// Spec: std.channels, clause "An open past `perCaller` streams for one caller gets `{ kind: 'closed', reason: 'full' }` as its only event, and the earlier streams continue."
// Seed 1337
// Assumption: config reaches `createApp({ std })` from the serving module's manifest `std: { '@keel/std-channels': { perCaller } }`.
import fc from "fast-check";
import { expect, test } from "vitest";
import { type Stream, serve, settle, waitFor } from "./fixtures.ts";

const CLAUSE =
  "An open past `perCaller` streams for one caller gets `{ kind: 'closed', reason: 'full' }` as its only event, and the earlier streams continue.";

async function check(perCaller: number | undefined, cap: number): Promise<void> {
  const h = await serve(perCaller === undefined ? {} : { perCaller });
  try {
    const cookie = await h.enroll();
    const other = await h.enroll();
    const kept: Stream[] = [];
    for (let i = 0; i < cap; i++) kept.push(await h.open("r", cookie));
    await waitFor(() => kept.every((st) => st.events.length >= 1));
    const over = await h.open("r", cookie);
    await waitFor(() => over.ended());
    await settle();
    expect(over.events).toEqual([{ kind: "closed", reason: "full" }]);
    for (const st of kept) expect(st.ended()).toBe(false);
    // another caller is not counted against this one
    const fresh = await h.open("r", other);
    await waitFor(() => fresh.events.length >= 1);
    expect(fresh.events[0]).toEqual({ kind: "reset" });
    await h.act("bump", cookie);
    for (const st of kept) {
      await waitFor(() =>
        st.events.some((e) => JSON.stringify(e) === JSON.stringify({ kind: "saved", store: "chan.log", head: 1 })),
      );
    }
    for (const st of [...kept, fresh]) st.close();
  } finally {
    await h.dispose();
  }
}

test(`${CLAUSE} (configured \`perCaller\`)`, async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 4 }), (n) => check(n, n)),
    {
      seed: 1337,
      numRuns: 4,
    },
  );
});

test(`${CLAUSE} (default \`perCaller\` is 8)`, async () => {
  await check(undefined, 8);
});
