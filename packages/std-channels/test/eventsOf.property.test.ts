import { s } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import type { ChannelEvent } from "../src/ChannelEvent.ts";
import { eventsOf } from "../src/internal/eventsOf.ts";

const Msg = s.object({ text: s.string() });
const event: fc.Arbitrary<ChannelEvent<{ text: string }>> = fc.oneof(
  fc.constant({ kind: "reset" } as const),
  fc.record({ kind: fc.constant("saved" as const), store: fc.string(), head: fc.nat() }),
  fc.record({ kind: fc.constant("message" as const), message: fc.record({ text: fc.string() }) }),
  fc.record({ kind: fc.constant("closed" as const), reason: fc.constantFrom("denied" as const, "full" as const) }),
);

test("every channel event encodes to exactly its own keys and parses back to itself", () => {
  const schema = eventsOf(Msg);
  fc.assert(
    fc.property(event, (e) => {
      const wire = schema.encode(e);
      expect(Object.keys(Object(wire)).sort()).toEqual(Object.keys(e).sort());
      expect(schema.parse(JSON.parse(JSON.stringify(wire)))).toEqual({ ok: true, value: e });
    }),
    { seed: 1337, numRuns: 200 },
  );
});

test("without a message schema a message event does not parse; the other kinds do", () => {
  const schema = eventsOf(undefined);
  expect(schema.parse({ kind: "message", message: { text: "x" } }).ok).toBe(false);
  expect(schema.parse({ kind: "reset" }).ok).toBe(true);
  expect(schema.parse({ kind: "closed", reason: "gone" }).ok).toBe(false);
  expect(schema.parse({ kind: "saved", store: "a", head: -1 }).ok).toBe(false);
});
