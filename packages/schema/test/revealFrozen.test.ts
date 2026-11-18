// k.privacy Secrets: what `reveal` returns cannot be changed in place, so the value a scope walked is the value it
// holds. Seed 1337.
import { describe, expect, test } from "vitest";
import { reveal, s } from "../src/index.ts";

describe("a revealed value", () => {
  // Open: `Secret.of` freezes the `Secret`, not its value.
  test.fails("is frozen deep", () => {
    const parsed = s.secret(s.object({ a: s.string(), list: s.array(s.string()) })).parse({ a: "x", list: ["y"] });
    if (!parsed.ok) throw new Error("parse");
    const v = reveal(parsed.value);
    expect(Object.isFrozen(v)).toBe(true);
    expect(Object.isFrozen(v.list)).toBe(true);
  });
});
