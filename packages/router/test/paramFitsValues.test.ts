// k.guards Carried params: which page params nodes fit a redirect route's, value by value. An `enum` or `literal`
// fits when the target parses each of its values; bounds fit when they lie within the target's. `manifest` reports a
// misfit as E1508 naming the page, the redirect and the param.
import { err, s } from "@keel/schema";
import type { Schema } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
import { contract } from "../src/contract/contract.ts";
import { guard } from "../src/guard.ts";
import { paramFits } from "../src/internal/paramFits.ts";
import { manifest } from "../src/manifest.ts";

const SEED = 1337;
type Any = Schema<unknown, boolean>;
const fits = (page: Any, target: Any): boolean => paramFits(page.node, target.node);

describe("a literal or enum page param", () => {
  it("fits a string target that parses each value: not blank where required, within its length", () => {
    expect(fits(s.literal("ab"), s.string())).toBe(true);
    expect(fits(s.literal("ab"), s.string({ min: 2 }))).toBe(true);
    expect(fits(s.literal("ab"), s.string({ min: 3 }))).toBe(false);
    expect(fits(s.literal("ab"), s.string({ max: 2 }))).toBe(true);
    expect(fits(s.literal("ab"), s.string({ max: 1 }))).toBe(false);
    expect(fits(s.literal("a"), s.string({ min: 1 }))).toBe(true);
    expect(fits(s.literal(" "), s.string({ min: 1 }))).toBe(false);
    expect(fits(s.literal(" "), s.string({ min: 0 }))).toBe(true);
    expect(fits(s.literal("  "), s.string({ min: 2 }))).toBe(false);
    expect(fits(s.literal(5), s.string())).toBe(false);
    expect(fits(s.literal(true), s.string())).toBe(false);
    expect(fits(s.enum(["a", "bb"]), s.string({ max: 2 }))).toBe(true);
    expect(fits(s.enum(["a", "bbb"]), s.string({ max: 2 }))).toBe(false);
    expect(fits(s.enum(["bbb", "a"]), s.string({ max: 2 }))).toBe(false);
  });

  it("fits an enum or literal target that holds each value", () => {
    expect(fits(s.literal("a"), s.enum(["a", "b"]))).toBe(true);
    expect(fits(s.literal("c"), s.enum(["a", "b"]))).toBe(false);
    expect(fits(s.literal(5), s.enum(["5"]))).toBe(false);
    expect(fits(s.enum(["a"]), s.enum(["a", "b"]))).toBe(true);
    expect(fits(s.enum(["a", "c"]), s.enum(["a", "b"]))).toBe(false);
    expect(fits(s.enum(["a"]), s.literal("a"))).toBe(true);
    expect(fits(s.enum(["a", "b"]), s.literal("a"))).toBe(false);
    expect(fits(s.literal("a"), s.literal("b"))).toBe(false);
    expect(fits(s.literal(1), s.literal("1"))).toBe(false);
  });

  it("fits an id target only as a string that is not empty", () => {
    expect(fits(s.literal("u1"), s.id("User"))).toBe(true);
    expect(fits(s.enum(["u1", "u2"]), s.id("User"))).toBe(true);
    expect(fits(s.literal(""), s.id("User"))).toBe(false);
    expect(fits(s.literal(5), s.id("User"))).toBe(false);
    expect(fits(s.literal(true), s.id("User"))).toBe(false);
  });

  it("fits a number target as a finite number within its bounds", () => {
    expect(fits(s.literal(5), s.number())).toBe(true);
    expect(fits(s.literal(5.5), s.number({ min: 5.5, max: 5.5 }))).toBe(true);
    expect(fits(s.literal(5), s.number({ min: 6 }))).toBe(false);
    expect(fits(s.literal(5), s.number({ max: 4 }))).toBe(false);
    expect(fits(s.literal("5"), s.number())).toBe(false);
    expect(fits(s.literal(true), s.number())).toBe(false);
    expect(fits(s.enum(["5"]), s.number())).toBe(false);
  });

  it("fits an int target as a safe integer within its bounds", () => {
    expect(fits(s.literal(5), s.int())).toBe(true);
    expect(fits(s.literal(5), s.int({ min: 5, max: 5 }))).toBe(true);
    expect(fits(s.literal(5.5), s.int())).toBe(false);
    expect(fits(s.literal(5), s.int({ min: 6 }))).toBe(false);
    expect(fits(s.literal(5), s.int({ max: 4 }))).toBe(false);
    expect(fits(s.literal("5"), s.int())).toBe(false);
    expect(fits(s.literal(true), s.int())).toBe(false);
    expect(fits(s.literal(2 ** 60), s.int())).toBe(false);
    expect(fits(s.literal(2 ** 60), s.number())).toBe(true);
  });

  it("fits no target of another kind", () => {
    expect(fits(s.literal(true), s.boolean())).toBe(false);
    expect(fits(s.literal("true"), s.boolean())).toBe(false);
    expect(fits(s.enum(["a"]), s.boolean())).toBe(false);
    expect(fits(s.literal("a"), s.object({}))).toBe(false);
  });

  it("a literal fits a target exactly when the target parses its value", () => {
    const targets = [
      s.string(),
      s.string({ min: 1 }),
      s.string({ min: 2, max: 3 }),
      s.enum(["a", "bb"]),
      s.literal("a"),
      s.literal(3),
      s.id("User"),
      s.number({ min: 0, max: 4 }),
      s.int({ min: 1 }),
    ];
    const value = fc.oneof(
      fc.constantFrom("", " ", "a", "bb", "cccc"),
      fc.integer({ min: -2, max: 6 }),
      fc.constantFrom(0.5, 3.5),
    );
    fc.assert(
      fc.property(value, fc.constantFrom(...targets), (v, target) => {
        expect(fits(s.literal(v), target), `${JSON.stringify(v)} in ${JSON.stringify(target.node)}`).toBe(
          target.parse(v).ok,
        );
      }),
      { seed: SEED, numRuns: 300 },
    );
  });
});

describe("bounds", () => {
  it("fit when they lie within the target's, an absent bound unbounded", () => {
    expect(fits(s.int({ min: 1, max: 5 }), s.int({ max: 5 }))).toBe(true);
    expect(fits(s.int({ min: 1, max: 5 }), s.int({ min: 1 }))).toBe(true);
    expect(fits(s.int({ min: 1, max: 5 }), s.int({ max: 4 }))).toBe(false);
    expect(fits(s.int({ min: 1, max: 5 }), s.int({ min: 2 }))).toBe(false);
    expect(fits(s.int({ max: 5 }), s.int({ min: 0, max: 9 }))).toBe(false);
    expect(fits(s.int({ min: 1 }), s.int({ min: 0, max: 9 }))).toBe(false);
    expect(fits(s.number({ min: 1, max: 2 }), s.number({ min: 1 }))).toBe(true);
    expect(fits(s.number({ min: 1, max: 2 }), s.number({ min: 1.5 }))).toBe(false);
    expect(fits(s.string({ min: 2, max: 4 }), s.string({ max: 4 }))).toBe(true);
    expect(fits(s.string({ min: 2, max: 4 }), s.string({ min: 3 }))).toBe(false);
    expect(fits(s.string({ max: 4 }), s.int())).toBe(false);
  });

  it("hold for a router loaded afresh, where a pii mark changes no fit", async () => {
    vi.resetModules();
    const fresh = await import("../src/internal/paramFits.ts");
    expect(fresh.paramFits(s.int({ min: 1, max: 5 }).node, s.int({ min: 1 }).node)).toBe(true);
    expect(fresh.paramFits(s.int({ min: 1, max: 5 }).node, s.int({ min: 2 }).node)).toBe(false);
    expect(fresh.paramFits(s.literal(5).node, s.int({ min: 6 }).node)).toBe(false);
    expect(fresh.paramFits(s.string().pii("contact").node, s.string().node)).toBe(true);
    expect(fresh.paramFits(s.id("User").node, s.id("Recipe").node)).toBe(false);
  });
});

describe("manifest over carried params", () => {
  const Denied = s.error("keel.denied", s.object({}));
  /** A component for a table that renders no page. */
  const view = (): Node => {
    throw new Error("no page renders here");
  };
  const refusal = (page: Any | undefined, target: Any): string | null => {
    const c = contract("c", {
      "c.page": page === undefined ? { path: "/p" } : { path: "/p/:org", params: s.object({ org: page }) },
      "c.login": { path: "/login/:org", params: s.object({ org: target }) },
    });
    const toLogin = guard({ redirect: "c.login" }, async () => err(Denied.make({})));
    try {
      manifest(c, { "c.page": { component: view, guard: toLogin }, "c.login": { component: view } });
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
    return null;
  };

  it("E1508 names the page, the redirect and the param the page lacks or whose node does not fit", () => {
    expect(refusal(s.string(), s.string())).toBeNull();
    expect(refusal(s.literal("a"), s.enum(["a", "b"]))).toBeNull();
    expect(refusal(undefined, s.string())).toBe(
      'E1508 c.page: guard redirect to "c.login" carries param "org", which the page lacks',
    );
    expect(refusal(s.string(), s.enum(["a", "b"]))).toBe(
      'E1508 c.page: guard redirect to "c.login" carries param "org", which does not fit',
    );
  });
});
