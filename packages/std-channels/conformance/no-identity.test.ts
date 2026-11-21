// Spec: std.channels, clause "No delivered event holds a caller hash, a cookie value or a store's state."
// Seed 1337
import fc from "fast-check";
import { expect, test } from "vitest";
import { roomChannel, serve, settle, waitFor } from "./fixtures.ts";

test("No delivered event holds a caller hash, a cookie value or a store's state.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.stringMatching(/^[a-z]{6,12}$/), async (word) => {
      const h = await serve();
      try {
        const marker = `state-${word}`;
        const cookie = await h.enroll();
        const st = await h.open("a", cookie);
        await waitFor(() => st.events.length >= 1);
        // a save whose store state holds the marker, a plain save, a message, then a denial
        const note = await h.post("/api/note", { text: marker }, { cookie });
        expect(note.status).toBe(200);
        await h.act("bump", cookie);
        const sent = await h.post(roomChannel.path, { message: { text: "hello" } }, { cookie, search: "?room=a" });
        expect(sent.status).toBe(200);
        await waitFor(() => st.events.length >= 4);
        await h.leave(cookie);
        await waitFor(() => st.ended());
        await settle();
        const wire = st.raw();
        const value = cookie.split("=").slice(1).join("=");
        const secrets = [
          cookie,
          value,
          ...value.split(".").filter((p) => p.length >= 8),
          ...h.seen.filter((c) => c !== ""),
        ];
        expect(h.seen.some((c) => c !== "")).toBe(true);
        for (const secret of secrets) {
          expect(wire).not.toContain(secret);
          expect(JSON.stringify(st.events)).not.toContain(secret);
        }
        expect(wire).not.toContain(marker);
        for (const e of st.events) {
          const keys = Object.keys(Object(e)).sort();
          const kind = Reflect.get(Object(e), "kind");
          if (kind === "reset") expect(keys).toEqual(["kind"]);
          if (kind === "saved") expect(keys).toEqual(["head", "kind", "store"]);
          if (kind === "message") expect(keys).toEqual(["kind", "message"]);
          if (kind === "closed") expect(keys).toEqual(["kind", "reason"]);
        }
        expect(st.events).toContainEqual({ kind: "message", message: { text: "hello" } });
      } finally {
        await h.dispose();
      }
    }),
    { seed: 1337, numRuns: 10 },
  );
});
