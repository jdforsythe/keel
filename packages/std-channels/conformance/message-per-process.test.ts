// Spec: std.channels, clause "Under sim, with one `createApp` serving a channel route whose `stores` creates store `s` and a member stream open, an action that saves `s` to head `h` and answers, then a member's publish of `m` to that channel and params, give that stream `{ kind: 'saved', store: 's', head: h }` and then `{ kind: 'message', message: m }`, in that order."
// Spec: std.channels, clause "Under sim, a member stream opened after a publish of `m` to its channel and params was answered `ok` gets `{ kind: 'reset' }` first and never a `{ kind: 'message', message: m }` for that publish."
// std.channels, prose (not a Conformance bullet) "A `message` reaches the member streams open in the process that serves its publish and no other; nothing stores, notifies or resends it, so a stream closed, reopening or on another replica then never gets it."
// std.channels, prose (not a Conformance bullet) "A publish served after a save of a store in `stores` resolved in the same process reaches each stream after that save's `saved` or `reset`, if any."
// Seed: 1337.
// Reading: "never a message for that publish" is checked after the stream settles and after later saves and publishes, by the unique text of each published message.
// Reading: a stream "closed, reopening" is one aborted by the client and opened again by a member after the publish; "on another replica" is B on `replica(a)`.
import fc from "fast-check";
import { afterEach, expect, test } from "vitest";
import { field, roomChannel, serve, settle, waitFor } from "./fixtures.ts";
import { type Pair, SEED, serveReplicas } from "./replica-fixtures.ts";

const pairs: Pair[] = [];
afterEach(async () => {
  for (const p of pairs.splice(0)) await p.close();
});

const unique = fc.uniqueArray(fc.hexaString({ minLength: 6, maxLength: 12 }), { minLength: 1, maxLength: 5 });
const messageOf = (e: unknown): unknown =>
  field(e, "kind") === "message" ? field(field(e, "message"), "text") : undefined;
const messages = (events: readonly unknown[]): unknown[] =>
  events.flatMap((e) => (field(e, "kind") === "message" ? [messageOf(e)] : []));

test("Under sim, with one `createApp` serving a channel route whose `stores` creates store `s` and a member stream open, an action that saves `s` to head `h` and answers, then a member's publish of `m` to that channel and params, give that stream `{ kind: 'saved', store: 's', head: h }` and then `{ kind: 'message', message: m }`, in that order", async () => {
  await fc.assert(
    fc.asyncProperty(unique, async (texts) => {
      const h = await serve();
      try {
        const cookie = await h.enroll();
        const st = await h.open("r", cookie);
        await waitFor(() => st.events.length >= 1);
        const expected: unknown[] = [{ kind: "reset" }];
        for (const [i, text] of texts.entries()) {
          await h.act("bump", cookie);
          const res = await h.post(roomChannel.path, { message: { text } }, { cookie, search: "?room=r" });
          expect(res.status).toBe(200);
          expected.push({ kind: "saved", store: "chan.log", head: i + 1 }, { kind: "message", message: { text } });
        }
        await waitFor(() => st.events.length >= expected.length);
        await settle();
        expect(st.events).toEqual(expected);
        st.close();
      } finally {
        await h.dispose();
      }
    }),
    { seed: SEED, numRuns: 10 },
  );
});

test("Under sim, a member stream opened after a publish of `m` to its channel and params was answered `ok` gets `{ kind: 'reset' }` first and never a `{ kind: 'message', message: m }` for that publish", async () => {
  await fc.assert(
    fc.asyncProperty(unique, fc.boolean(), async (texts, saveAfter) => {
      const h = await serve();
      try {
        const cookie = await h.enroll();
        for (const text of texts) {
          const res = await h.post(roomChannel.path, { message: { text } }, { cookie, search: "?room=r" });
          expect(res.status).toBe(200);
        }
        const st = await h.open("r", cookie);
        await waitFor(() => st.events.length >= 1);
        expect(st.events[0]).toEqual({ kind: "reset" });
        if (saveAfter) {
          await h.act("bump", cookie);
          await waitFor(() => st.events.length >= 2);
        }
        await settle();
        expect(messages(st.events)).toEqual([]);
        for (const text of texts) expect(st.raw().includes(text)).toBe(false);
        st.close();
      } finally {
        await h.dispose();
      }
    }),
    { seed: SEED, numRuns: 10 },
  );
});

test("a stream closed and reopened after a publish never gets that message, and the reopened stream starts with `reset`", async () => {
  await fc.assert(
    fc.asyncProperty(unique, async (texts) => {
      const h = await serve();
      try {
        const cookie = await h.enroll();
        const first = await h.open("r", cookie);
        await waitFor(() => first.events.length >= 1);
        first.close();
        await waitFor(() => first.ended());
        for (const text of texts) {
          await h.post(roomChannel.path, { message: { text } }, { cookie, search: "?room=r" });
        }
        const again = await h.open("r", cookie);
        await waitFor(() => again.events.length >= 1);
        await settle();
        expect(again.events).toEqual([{ kind: "reset" }]);
        expect(messages(first.events)).toEqual([]);
        again.close();
      } finally {
        await h.dispose();
      }
    }),
    { seed: SEED, numRuns: 8 },
  );
});

test("a stream open on another replica when a message is published never gets it, and one opened there afterwards starts with `reset` and never gets it", async () => {
  await fc.assert(
    fc.asyncProperty(unique, async (texts) => {
      const p = await serveReplicas();
      pairs.push(p);
      const cookieA = await p.A.enroll();
      const onA = await p.A.open("r", cookieA);
      const openB = await p.B.open("r", await p.B.enroll());
      await waitFor(() => onA.events.length >= 1 && openB.events.length >= 1);
      for (const text of texts) {
        const res = await p.A.post(roomChannel.path, { message: { text } }, { cookie: cookieA, search: "?room=r" });
        expect(res.status).toBe(200);
      }
      await waitFor(() => messages(onA.events).length === texts.length);
      const lateB = await p.B.open("r", await p.B.enroll());
      await waitFor(() => lateB.events.length >= 1);
      // a later save crosses to B; the earlier messages do not follow it
      await p.A.act("bump");
      await waitFor(() =>
        [openB, lateB].every((st) =>
          st.events.some((e) => field(e, "kind") === "saved" && field(e, "store") === "chan.log"),
        ),
      );
      await settle();
      expect(messages(onA.events)).toEqual(texts);
      expect(lateB.events[0]).toEqual({ kind: "reset" });
      for (const st of [openB, lateB]) {
        expect(messages(st.events)).toEqual([]);
        for (const text of texts) expect(st.raw().includes(text)).toBe(false);
        st.close();
      }
      onA.close();
    }),
    { seed: SEED, numRuns: 6 },
  );
});

test("a publish served on A after a save resolved on A reaches A's stream after that save's `saved`, and a publish on A never reaches B in place of or beside B's `saved`", async () => {
  await fc.assert(
    fc.asyncProperty(unique, async (texts) => {
      const p = await serveReplicas();
      pairs.push(p);
      const cookieA = await p.A.enroll();
      const onA = await p.A.open("r", cookieA);
      const onB = await p.B.open("r", await p.B.enroll());
      await waitFor(() => onA.events.length >= 1 && onB.events.length >= 1);
      for (const [i, text] of texts.entries()) {
        await p.A.act("bump");
        await p.A.post(roomChannel.path, { message: { text } }, { cookie: cookieA, search: "?room=r" });
        await waitFor(() => messages(onA.events).length === i + 1);
      }
      await waitFor(() => onB.events.some((e) => field(e, "kind") === "saved" && field(e, "head") === texts.length));
      await settle();
      // `chan.members` saves (B's enrolment) also reach A: only `chan.log` and messages are compared.
      const kinds = onA.events
        .slice(1)
        .flatMap((e) => (field(e, "store") === "chan.members" ? [] : [field(e, "kind")]));
      expect(kinds).toEqual(texts.flatMap(() => ["saved", "message"]));
      expect(messages(onB.events)).toEqual([]);
      onA.close();
      onB.close();
    }),
    { seed: SEED, numRuns: 6 },
  );
});
