// Spec: std.channels, clause "With `identify` answering `'u1'` for a stream's cookie, then `''` once that session is removed, the next save of its stores gives that stream `{ kind: 'closed', reason: 'denied' }` and no `saved`; another member's stream gets `saved`."
// Spec: std.channels, clause "Five saves within 500 ms on the sim clock run `identify` once for an open stream; a save 1,000 ms after the check runs it again."
// Spec: std.channels, clause "`identify` throwing or not settling within 5,000 ms at a delivery closes that stream `denied`."
// Spec: std.channels, Serve "Before each delivery to an open stream (`saved`, `changed` or `message`) the route calls `currentUser()` (k.user); an answer other than the stream's `user` gives `{ kind: 'closed', reason: 'denied' }` in place of that event, then the end. An answer given less than 1,000 ms earlier on `ctx.clock` for that stream stands, so a burst of saves costs one `identify` per stream per second. Deliveries to one stream keep their order; the checks of different streams run independently, so one slow `identify` delays only its own stream. A publisher's own `currentUser()` is not asked: a publish is a request and runs `identify` as one."
// Seed 1337
// Pending (rfc:0193): skipped until the build lands; the builder un-skips by changing each `test.skip` to `test` in this file.
// Assumption: the rig of identify-fixtures.ts; "the check" is the `identify` run for a stream after its open, counted as `streamCalls(sid)` minus the calls at open; a `changed` delivery is the same path as `saved` and is covered by the 0192 follows files.
import fc from "fast-check";
import { expect, test } from "vitest";
import { settle, waitFor } from "./fixtures.ts";
import { serveIdentified } from "./identify-fixtures.ts";

const SAVED =
  "With `identify` answering `'u1'` for a stream's cookie, then `''` once that session is removed, the next save of its stores gives that stream `{ kind: 'closed', reason: 'denied' }` and no `saved`; another member's stream gets `saved`.";
const BURST =
  "Five saves within 500 ms on the sim clock run `identify` once for an open stream; a save 1,000 ms after the check runs it again.";
const FAIL = "`identify` throwing or not settling within 5,000 ms at a delivery closes that stream `denied`.";
const SERVE = "Serve: before each delivery the route calls `currentUser()`";

test(`${SAVED} (a removed session's stream is closed denied with no saved; another member's gets saved)`, async () => {
  const h = await serveIdentified();
  try {
    h.sessions.set("a", "u1");
    h.sessions.set("b", "u2");
    const sa = await h.open("r", "a");
    const sb = await h.open("r", "b");
    await waitFor(() => sa.events.length >= 1 && sb.events.length >= 1);
    h.sessions.delete("a");
    await h.bump("b");
    await waitFor(() => sa.ended());
    await waitFor(() => sb.events.length >= 2);
    expect(sa.events).toEqual([{ kind: "reset" }, { kind: "closed", reason: "denied" }]);
    expect(sb.events[0]).toEqual({ kind: "reset" });
    expect(sb.events[1]).toMatchObject({ kind: "saved" });
    sb.close();
  } finally {
    await h.dispose();
  }
});

test(`${SERVE} (an answer other than the stream's user, any user id, gives closed denied in place of the saved)`, async () => {
  await fc.assert(
    fc.asyncProperty(fc.stringMatching(/^[a-z]{1,8}$/), fc.stringMatching(/^[a-z]{1,8}$/), async (u, v) => {
      fc.pre(u !== v);
      const h = await serveIdentified();
      try {
        h.sessions.set("a", u);
        const st = await h.open("r", "a");
        await waitFor(() => st.events.length >= 1);
        h.sessions.set("a", v);
        await h.bump("a");
        await waitFor(() => st.ended());
        expect(st.events).toEqual([{ kind: "reset" }, { kind: "closed", reason: "denied" }]);
      } finally {
        await h.dispose();
      }
    }),
    { seed: 1337, numRuns: 8 },
  );
});

test(`${SERVE} (an unchanged answer delivers the saved, in save order, any number of saves)`, async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 4 }), async (n) => {
      const h = await serveIdentified();
      try {
        h.sessions.set("a", "u1");
        const st = await h.open("r", "a");
        await waitFor(() => st.events.length >= 1);
        for (let i = 0; i < n; i++) {
          await h.bump("a");
          await waitFor(() => st.events.length >= 2 + i);
          h.ctx.clock.advance(1_000);
        }
        await settle();
        expect(
          st.events.slice(1).every((e) => typeof e === "object" && e !== null && Reflect.get(e, "kind") === "saved"),
        ).toBe(true);
        expect(st.events).toHaveLength(1 + n);
        st.close();
      } finally {
        await h.dispose();
      }
    }),
    { seed: 1337, numRuns: 6 },
  );
});

test(`${SERVE} (a changed answer closes a stream in place of a \`message\` as well)`, async () => {
  const h = await serveIdentified();
  try {
    h.sessions.set("a", "u1");
    h.sessions.set("p", "u2");
    const st = await h.open("r", "a");
    await waitFor(() => st.events.length >= 1);
    h.sessions.delete("a");
    expect((await h.publish("r", "p", "hi")).status).toBe(200);
    await waitFor(() => st.ended());
    expect(st.events).toEqual([{ kind: "reset" }, { kind: "closed", reason: "denied" }]);
  } finally {
    await h.dispose();
  }
});

test(`${BURST} (five saves within 500 ms cost one identify for the stream)`, async () => {
  const h = await serveIdentified();
  try {
    h.sessions.set("a", "u1");
    const st = await h.open("r", "a");
    await waitFor(() => st.events.length >= 1);
    const atOpen = h.streamCalls("a");
    for (let i = 0; i < 5; i++) {
      await h.bump("a");
      h.ctx.clock.advance(100);
      await settle();
    }
    await waitFor(() => st.events.length >= 6);
    expect(h.streamCalls("a") - atOpen).toBe(1);
    st.close();
  } finally {
    await h.dispose();
  }
});

test(`${BURST} (saves any number within one second of the check cost one identify; one 1,000 ms after costs another)`, async () => {
  await fc.assert(
    fc.asyncProperty(fc.array(fc.integer({ min: 0, max: 99 }), { minLength: 2, maxLength: 5 }), async (gaps) => {
      const h = await serveIdentified();
      try {
        h.sessions.set("a", "u1");
        const st = await h.open("r", "a");
        await waitFor(() => st.events.length >= 1);
        const atOpen = h.streamCalls("a");
        for (const gap of gaps) {
          await h.bump("a");
          h.ctx.clock.advance(gap);
          await settle();
        }
        await waitFor(() => st.events.length >= 1 + gaps.length);
        expect(h.streamCalls("a") - atOpen).toBe(1);
        h.ctx.clock.advance(1_000);
        await h.bump("a");
        await waitFor(() => st.events.length >= 2 + gaps.length);
        expect(h.streamCalls("a") - atOpen).toBe(2);
        st.close();
      } finally {
        await h.dispose();
      }
    }),
    { seed: 1337, numRuns: 6 },
  );
});

test(`${BURST} (an answer that stands is not read again: a removal within the second shows at the next check)`, async () => {
  const h = await serveIdentified();
  try {
    h.sessions.set("a", "u1");
    const st = await h.open("r", "a");
    await waitFor(() => st.events.length >= 1);
    await h.bump("a");
    await waitFor(() => st.events.length >= 2);
    h.sessions.delete("a");
    h.ctx.clock.advance(500);
    await h.bump("a");
    await waitFor(() => st.events.length >= 3);
    expect(st.ended()).toBe(false);
    h.ctx.clock.advance(1_000);
    await h.bump("a");
    await waitFor(() => st.ended());
    expect(st.events.at(-1)).toEqual({ kind: "closed", reason: "denied" });
  } finally {
    await h.dispose();
  }
});

test(`${FAIL} (identify throwing)`, async () => {
  const h = await serveIdentified();
  try {
    h.sessions.set("a", "u1");
    const st = await h.open("r", "a");
    await waitFor(() => st.events.length >= 1);
    h.sessions.set("b", "u2");
    h.modes.set("a", "throw");
    await h.bump("b");
    await waitFor(() => st.ended());
    expect(st.events).toEqual([{ kind: "reset" }, { kind: "closed", reason: "denied" }]);
  } finally {
    await h.dispose();
  }
});

test(`${FAIL} (identify not settling: the stream is open at 4,999 ms and closed denied at 5,000 ms)`, async () => {
  const h = await serveIdentified();
  try {
    h.sessions.set("a", "u1");
    const st = await h.open("r", "a");
    await waitFor(() => st.events.length >= 1);
    h.sessions.set("b", "u2");
    h.modes.set("a", "hang");
    await h.bump("b");
    await settle();
    h.ctx.clock.advance(4_999);
    await settle();
    expect(st.ended()).toBe(false);
    h.ctx.clock.advance(1);
    await waitFor(() => st.ended());
    expect(st.events).toEqual([{ kind: "reset" }, { kind: "closed", reason: "denied" }]);
  } finally {
    await h.dispose();
  }
});

test(`${SERVE} (one slow identify delays only its own stream)`, async () => {
  const h = await serveIdentified();
  try {
    h.sessions.set("a", "u1");
    h.sessions.set("b", "u2");
    const sa = await h.open("r", "a");
    const sb = await h.open("r", "b");
    await waitFor(() => sa.events.length >= 1 && sb.events.length >= 1);
    h.modes.set("a", "hang");
    await h.bump("b");
    await waitFor(() => sb.events.length >= 2);
    expect(sb.events[1]).toMatchObject({ kind: "saved" });
    expect(sa.events).toEqual([{ kind: "reset" }]);
    sa.close();
    sb.close();
  } finally {
    await h.dispose();
  }
});

test(`${SERVE} (a publisher's own currentUser() is not asked: the publish runs identify once, as a request)`, async () => {
  const h = await serveIdentified();
  try {
    h.sessions.set("p", "u1");
    const before = h.otherCalls("p");
    expect((await h.publish("r", "p", "hi")).status).toBe(200);
    expect(h.otherCalls("p") - before).toBe(1);
    expect(h.streamCalls("p")).toBe(0);
  } finally {
    await h.dispose();
  }
});
