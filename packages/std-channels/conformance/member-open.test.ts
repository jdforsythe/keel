// Spec: std.channels, clause "A caller for whom `member` is false at open gets `{ kind: 'closed', reason: 'denied' }` as its only event; a cookieless open has caller `""` and its response sets no cookie."
// Seed 1337
import fc from "fast-check";
import { expect, test } from "vitest";
import { serve, settle, waitFor } from "./fixtures.ts";

const CLAUSE =
  "A caller for whom `member` is false at open gets `{ kind: 'closed', reason: 'denied' }` as its only event; a cookieless open has caller `\"\"` and its response sets no cookie.";

test(`${CLAUSE} (a non-member's open, for any params)`, async () => {
  await fc.assert(
    fc.asyncProperty(fc.stringMatching(/^[a-z]{1,6}$/), async (room) => {
      const h = await serve();
      try {
        const cookie = await h.mint();
        const st = await h.open(room, cookie);
        await waitFor(() => st.ended());
        await settle();
        expect(st.events).toEqual([{ kind: "closed", reason: "denied" }]);
        expect(h.seen).toHaveLength(1);
      } finally {
        await h.dispose();
      }
    }),
    { seed: 1337, numRuns: 10 },
  );
});

test(`${CLAUSE} (a cookieless open: \`member\` sees caller "" and no cookie is set, whether it holds or not)`, async () => {
  for (const allowed of [true, false]) {
    const h = await serve({ member: (caller) => allowed && caller === "" });
    try {
      const st = await h.open("r");
      await waitFor(() => st.events.length >= 1);
      await settle();
      expect(h.seen).toEqual([""]);
      expect(st.headers.get("set-cookie")).toBeNull();
      expect(st.events[0]).toEqual(allowed ? { kind: "reset" } : { kind: "closed", reason: "denied" });
      if (!allowed) {
        await waitFor(() => st.ended());
        expect(st.events).toHaveLength(1);
      }
      st.close();
    } finally {
      await h.dispose();
    }
  }
});
