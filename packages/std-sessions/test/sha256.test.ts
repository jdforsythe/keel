// sha256 and the fingerprint (std.sessions): byte-equal with node:crypto. Seed 1337
import { createHash } from "node:crypto";
import fc from "fast-check";
import { expect, test } from "vitest";
import { fingerprint } from "../src/internal/fingerprint.ts";
import { sha256 } from "../src/internal/sha256.ts";

const node = (t: string): string => createHash("sha256").update(t).digest("hex");

test("sha256 equals node:crypto on block boundaries and on any string", () => {
  for (const t of ["", "abc", "a".repeat(55), "a".repeat(56), "a".repeat(64), "a".repeat(119), "héllo\nwörld 🙂"])
    expect(sha256(t)).toBe(node(t));
  fc.assert(
    fc.property(fc.string({ unit: "binary", maxLength: 300 }), (t) => sha256(t) === node(t)),
    { seed: 1337, numRuns: 200 },
  );
});

test("fingerprint is 12 hex of sha256(code, data.at, route id); none: '', '', route id", () => {
  const err = { code: "keel.unexpected", message: "boom", data: { at: "cart.checkout" } };
  expect(fingerprint(err, "cart.show")).toBe(node("keel.unexpected\ncart.checkout\ncart.show").slice(0, 12));
  expect(fingerprint(null, "cart.show")).toBe(node("\n\ncart.show").slice(0, 12));
  expect(fingerprint({ code: "cart.locked", message: "", data: { at: 3 } }, "r")).toBe(
    node("cart.locked\n\nr").slice(0, 12),
  );
  expect(fingerprint({ code: "c", message: "", data: null }, "r")).toBe(node("c\n\nr").slice(0, 12));
});
