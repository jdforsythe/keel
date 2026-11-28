// A channel holds the schemas its contract entries name (std.contracts): `events`, the stream entry's `output`, and,
// with `message`, `body`, the publish entry's `{ message }`; made once per channel, so an entry naming them holds the
// very schemas `channelRoute` checks for. Seed 1337
import { s } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import { channel } from "../src/channel.ts";

const SEED = 1337;
const text = fc.string({ maxLength: 12 });

test("for any message, `body` takes `{ message }` alone and `events` takes each event kind", () => {
  fc.assert(
    fc.property(text, fc.integer({ min: 0, max: 1000 }), (m, head) => {
      const ch = channel("m.room", { path: "/api/m/events", params: s.object({}), message: s.string() });
      expect(ch.body.parse({ message: m }).ok).toBe(true);
      expect(ch.body.parse({ message: head }).ok).toBe(false);
      expect(ch.events.parse({ kind: "message", message: m }).ok).toBe(true);
      expect(ch.events.parse({ kind: "saved", store: "m.s", head }).ok).toBe(true);
      expect(ch.events.parse({ kind: "reset" }).ok).toBe(true);
      expect(ch.events).toBe(ch.events);
    }),
    { seed: SEED, numRuns: 50 },
  );
});

test("a channel without message has no `body`, and its events have no message variant", () => {
  const plain = channel("m.plain", { path: "/api/m/plain", params: s.object({}) });
  expect(plain.body).toBeUndefined();
  expect(plain.events.parse({ kind: "reset" }).ok).toBe(true);
  expect(plain.events.parse({ kind: "message", message: "x" }).ok).toBe(false);
  expect(plain.events.parse({ kind: "closed", reason: "full" }).ok).toBe(true);
});
