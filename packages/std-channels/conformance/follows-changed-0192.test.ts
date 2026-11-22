// Spec: std.channels, clause "With `follows: [db]`, an open member stream gets `reset`, then `{ kind: 'changed' }` after a committed `changed` of its channel and params, and nothing for other params; a stream for which `member` is false at that point gets `closed` `denied`."
// Seed 1337
// Pending (rfc:0192): skipped until the build lands; the builder un-skips by changing each `test.skip` to `test` in this file.
// Assumption: the followed capability is the fake of follows-fixtures.ts, whose `changed(channel, params)` plays a committed std.postgres `changed`; "nothing" is shown by a later change for the stream's own params arriving first-and-only.
import fc from "fast-check";
import { expect, test } from "vitest";
import { roomChannel, settle, waitFor } from "./fixtures.ts";
import { serveFollowing } from "./follows-fixtures.ts";

const CLAUSE =
  "With `follows: [db]`, an open member stream gets `reset`, then `{ kind: 'changed' }` after a committed `changed` of its channel and params, and nothing for other params; a stream for which `member` is false at that point gets `closed` `denied`.";

test.skip(`${CLAUSE} (reset, then one changed per committed change of its channel and params)`, async () => {
  await fc.assert(
    fc.asyncProperty(fc.stringMatching(/^[a-z]{1,6}$/), fc.integer({ min: 1, max: 4 }), async (room, n) => {
      const h = await serveFollowing();
      try {
        const st = await h.open(room);
        await waitFor(() => st.events.length >= 1);
        expect(st.events[0]).toEqual({ kind: "reset" });
        for (let i = 1; i <= n; i++) {
          h.db.changed(roomChannel, { room });
          await waitFor(() => st.events.length >= 1 + i);
        }
        await settle();
        expect(st.events).toEqual([{ kind: "reset" }, ...Array.from({ length: n }, () => ({ kind: "changed" }))]);
        st.close();
      } finally {
        await h.dispose();
      }
    }),
    { seed: 1337, numRuns: 8 },
  );
});

test.skip(`${CLAUSE} (nothing for other params)`, async () => {
  const h = await serveFollowing();
  try {
    const st = await h.open("a");
    await waitFor(() => st.events.length >= 1);
    h.db.changed(roomChannel, { room: "b" });
    await settle();
    expect(st.events).toEqual([{ kind: "reset" }]);
    h.db.changed(roomChannel, { room: "a" });
    await waitFor(() => st.events.length >= 2);
    await settle();
    expect(st.events).toEqual([{ kind: "reset" }, { kind: "changed" }]);
    st.close();
  } finally {
    await h.dispose();
  }
});

test.skip(`${CLAUSE} (a stream for which \`member\` is false at that point gets closed denied)`, async () => {
  const h = await serveFollowing();
  try {
    const st = await h.open("a");
    await waitFor(() => st.events.length >= 1);
    h.allow.value = false;
    h.db.changed(roomChannel, { room: "a" });
    await waitFor(() => st.ended());
    expect(st.events).toEqual([{ kind: "reset" }, { kind: "closed", reason: "denied" }]);
  } finally {
    await h.dispose();
  }
});

test.skip(`${CLAUSE} (every open member stream of the same params gets it, others none)`, async () => {
  const h = await serveFollowing();
  try {
    const [a1, a2, b] = [await h.open("a"), await h.open("a"), await h.open("b")];
    await waitFor(() => [a1, a2, b].every((s) => s.events.length >= 1));
    h.db.changed(roomChannel, { room: "a" });
    await waitFor(() => a1.events.length >= 2 && a2.events.length >= 2);
    await settle();
    expect(a1.events).toEqual([{ kind: "reset" }, { kind: "changed" }]);
    expect(a2.events).toEqual([{ kind: "reset" }, { kind: "changed" }]);
    expect(b.events).toEqual([{ kind: "reset" }]);
    for (const s of [a1, a2, b]) s.close();
  } finally {
    await h.dispose();
  }
});
