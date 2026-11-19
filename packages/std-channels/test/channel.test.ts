import { type Schema, s } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import { channel } from "../src/channel.ts";

const codeOf = (fn: () => unknown): unknown => {
  try {
    fn();
  } catch (e) {
    return typeof e === "object" && e !== null ? Reflect.get(e, "code") : "thrown";
  }
  return null;
};

type Wrap = "object" | "array" | "optional" | "nullable" | "record";
const wrap = (inner: Schema<unknown>, ws: readonly Wrap[]): Schema<unknown> => {
  let out = inner;
  for (const w of ws) {
    if (w === "object") out = s.object({ k: out });
    if (w === "array") out = s.array(out);
    if (w === "optional") out = s.object({ o: out.optional() });
    if (w === "nullable") out = out.nullable();
    if (w === "record") out = s.record(out);
  }
  return out;
};
const wraps = fc.array(fc.constantFrom<Wrap>("object", "array", "optional", "nullable", "record"), { maxLength: 5 });

test("channel returns a frozen declaration holding its name, path and schemas", () => {
  const params = s.object({ room: s.string() });
  const message = s.object({ text: s.string() });
  const ch = channel("a.room", { path: "/api/room/events", params, message });
  expect(Object.isFrozen(ch)).toBe(true);
  expect(ch).toEqual({ name: "a.room", path: "/api/room/events", params, message });
});

test("E2602 for an s.secret under any nesting of the message schema, the root included; none without it", () => {
  fc.assert(
    fc.property(wraps, (ws) => {
      const make = (inner: Schema<unknown>) => () =>
        channel("a.c", { path: "/p", params: s.object({}), message: wrap(inner, ws) });
      expect(codeOf(make(s.secret(s.string())))).toBe("E2602");
      expect(codeOf(make(s.string()))).toBeNull();
    }),
    { seed: 1337, numRuns: 100 },
  );
});
