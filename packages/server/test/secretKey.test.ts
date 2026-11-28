import { type Schema, s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { secretKey } from "../src/internal/secretKey.ts";

describe("secretKey follows a form key through the schema", () => {
  const card = s.object({ name: s.string(), pin: s.secret(s.string()) });
  const root = s.object({
    cards: s.record(card),
    tags: s.array(s.string()),
    keys: s.array(s.secret(s.string())),
    pay: s.union("kind", [
      s.object({ kind: s.literal("card"), cvc: s.secret(s.string()) }),
      s.object({ kind: s.literal("cash"), note: s.string() }),
    ]),
    any: s.union([s.object({ a: s.string() }), s.object({ b: s.secret(s.string()) })]),
    opt: s.object({ token: s.secret(s.string()) }).optional(),
    plain: s.string(),
  }).node;

  it("takes a record's value for any segment and keeps the plain siblings", () => {
    expect(secretKey(root, "cards.x.pin")).toBe(true);
    expect(secretKey(root, "cards.x.name")).toBe(false);
  });
  it("tries each variant of a union and each member of an anyOf", () => {
    expect(secretKey(root, "pay.cvc")).toBe(true);
    expect(secretKey(root, "pay.note")).toBe(false);
    expect(secretKey(root, "pay.kind")).toBe(false);
    expect(secretKey(root, "any.b")).toBe(true);
    expect(secretKey(root, "any.a")).toBe(false);
  });
  it("ends at a node holding a secret, and meets an array whose item holds one", () => {
    expect(secretKey(root, "cards")).toBe(true);
    expect(secretKey(root, "cards.x")).toBe(true);
    expect(secretKey(root, "keys[]")).toBe(true);
    expect(secretKey(root, "keys")).toBe(true);
    expect(secretKey(root, "tags[]")).toBe(false);
    expect(secretKey(root, "plain")).toBe(false);
    expect(secretKey(root, "nope.pin")).toBe(false);
  });
  it("looks through optional wrappers", () => {
    expect(secretKey(root, "opt.token")).toBe(true);
  });
  it("answers a key over nested unions", () => {
    let node: Schema<unknown> = s.object({ leaf: s.secret(s.string()) });
    for (let i = 0; i < 6; i++) node = s.object({ n: s.union([node, node, s.object({ z: s.string() })]) });
    const key = `${"n.".repeat(6)}leaf`;
    expect(secretKey(node.node, key)).toBe(true);
    expect(secretKey(node.node, `${"n.".repeat(6)}z`)).toBe(false);
  });

  it("a record key holding dots reaches the secret under it, and a key of 200,000 segments costs linear time", () => {
    const rec = s.object({ r: s.record(s.record(s.object({ name: s.string(), pw: s.secret(s.string()) }))) });
    expect(secretKey(rec.node, "r.a.b.c.pw")).toBe(true);
    expect(secretKey(rec.node, "r.a.b.c.name")).toBe(false);
    const long = `r.${"x.".repeat(200_000)}name`;
    // A walk quadratic in the segments would take about 2 × 10^10 steps here and pass the test's time bound.
    expect(secretKey(rec.node, long)).toBe(false);
    expect(secretKey(rec.node, `r.${"x.".repeat(200_000)}pw`)).toBe(true);
  });
});
