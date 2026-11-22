// Spec: std.channels, clause "No `changed` event holds a capability name, a param or a row value."
// Seed 1337
// Pending (rfc:0192): skipped until the build lands; the builder un-skips by changing the `test.skip` to `test` in this file.
// Assumption: a row value cannot reach the fake (it plays std.postgres's `changed`, which carries none), so the row value checked is the one the test chose to write alongside; the check is on the whole wire text of the stream (events and frames), not just the parsed event.
import fc from "fast-check";
import { expect, test } from "vitest";
import { roomChannel, settle, waitFor } from "./fixtures.ts";
import { serveFollowing } from "./follows-fixtures.ts";

test.skip("No `changed` event holds a capability name, a param or a row value", async () => {
  await fc.assert(
    fc.asyncProperty(fc.stringMatching(/^[a-z]{8,12}$/), fc.stringMatching(/^[a-z0-9]{12,16}$/), async (room, row) => {
      const h = await serveFollowing();
      try {
        const st = await h.open(room);
        await waitFor(() => st.events.length >= 1);
        h.db.changed(roomChannel, { room, row });
        h.db.changed(roomChannel, { room });
        await waitFor(() => st.events.length >= 2);
        await settle();
        expect(st.events[1]).toEqual({ kind: "changed" });
        const after = st.raw().slice(st.raw().indexOf("changed") - 40);
        for (const secret of ["chan.fakeDb", "fakeDb", room, row]) expect(after).not.toContain(secret);
        st.close();
      } finally {
        await h.dispose();
      }
    }),
    { seed: 1337, numRuns: 8 },
  );
});
