import { s } from "@keel/schema";
import { store } from "@keel/store";
// Spec: store creation inside a scope (k.reactive ownership). Seed 1337.
import { describe, expect, it } from "vitest";

describe("k.store: creation", () => {
  it("Creating a store outside a scope throws", () => {
    expect(() => store(s.object({ n: s.int() }), { n: 0 })).toThrow();
  });
});
