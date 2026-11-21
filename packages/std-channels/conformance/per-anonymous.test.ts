// Spec: std.channels, clause "An open past `perAnonymous` cookieless streams, from any client, gets `{ kind: 'closed', reason: 'full' }` as its only event, and the earlier streams continue; with that bound reached, a caller with a cookie opens up to its `perCaller`."
// Seed 1337
// Assumption: config reaches `createApp({ std })` from the serving module's manifest `std: { '@keel/std-channels': { perCaller, perAnonymous } }`; the default `perAnonymous` is 64.
import fc from "fast-check";
import { expect, test } from "vitest";
import { type Stream, serve, settle, waitFor } from "./fixtures.ts";

const CLAUSE =
  "An open past `perAnonymous` cookieless streams, from any client, gets `{ kind: 'closed', reason: 'full' }` as its only event, and the earlier streams continue; with that bound reached, a caller with a cookie opens up to its `perCaller`.";

const SAVED = JSON.stringify({ kind: "saved", store: "chan.log", head: 1 });

async function check(opts: { perCaller?: number; perAnonymous?: number }, n: number, perCaller: number): Promise<void> {
  const h = await serve({ member: () => true, ...opts });
  try {
    const kept: Stream[] = [];
    for (let i = 0; i < n; i++) kept.push(await h.open("r"));
    await waitFor(() => kept.every((st) => st.events.length >= 1));
    for (const st of kept) expect(st.events[0]).toEqual({ kind: "reset" });
    const over = await h.open("r");
    await waitFor(() => over.ended());
    await settle();
    expect(over.events).toEqual([{ kind: "closed", reason: "full" }]);
    for (const st of kept) expect(st.ended()).toBe(false);
    const cookie = await h.mint();
    const own: Stream[] = [];
    for (let i = 0; i < perCaller; i++) own.push(await h.open("r", cookie));
    await waitFor(() => own.every((st) => st.events.length >= 1));
    for (const st of own) expect(st.events[0]).toEqual({ kind: "reset" });
    const past = await h.open("r", cookie);
    await waitFor(() => past.ended());
    await settle();
    expect(past.events).toEqual([{ kind: "closed", reason: "full" }]);
    await h.act("bump", cookie);
    for (const st of [...kept, ...own]) {
      await waitFor(() => st.events.some((e) => JSON.stringify(e) === SAVED));
    }
    for (const st of [...kept, ...own]) st.close();
  } finally {
    await h.dispose();
  }
}

test(`${CLAUSE} (configured \`perAnonymous\`, not held to \`perCaller\`)`, async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 3, max: 5 }), (n) => check({ perCaller: 2, perAnonymous: n }, n, 2)),
    { seed: 1337, numRuns: 3 },
  );
});

test(`${CLAUSE} (default \`perAnonymous\` is 64)`, async () => {
  await check({}, 64, 8);
});
