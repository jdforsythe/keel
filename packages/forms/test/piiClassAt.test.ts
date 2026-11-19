// k.privacy: the class lookup behind `data-k-pii` never gives a path less than `piiPaths` states for it.
import { type Schema, piiPaths, s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { piiClassAt } from "../src/internal/piiClassAt.ts";

const at = (schema: Schema<unknown, boolean>, path: string): string | undefined =>
  piiClassAt(schema.node, path === "" ? [] : path.split("."));
const listed = (schema: Schema<unknown, boolean>): Record<string, string> =>
  Object.fromEntries(piiPaths(schema).map((p) => [p.path, p.class]));

const twin = (marked: "first" | "second") =>
  s.union("k", [
    marked === "first"
      ? s.object({ k: s.literal("a"), name: s.string() }).pii("name")
      : s.object({ k: s.literal("a"), name: s.string() }),
    marked === "second"
      ? s.object({ k: s.literal("b"), name: s.string() }).pii("name")
      : s.object({ k: s.literal("b"), name: s.string() }),
  ]);

describe("a field declared by several union variants takes the class a marked one gives it", () => {
  it("only the second variant is marked, under a root field", () => {
    const schema = s.object({ u: twin("second") });
    expect(listed(schema)).toEqual({ "u.k": "name", "u.name": "name", "u.*": "name" });
    expect(["u.k", "u.name", "u.zz"].map((p) => at(schema, p))).toEqual(["name", "name", "name"]);
  });

  it("only the first variant is marked", () => {
    const schema = s.object({ u: twin("first") });
    expect(["u.k", "u.name", "u.zz"].map((p) => at(schema, p))).toEqual(["name", "name", "name"]);
  });

  it("a root union", () => {
    const schema = twin("second");
    expect(listed(schema)).toEqual({ k: "name", name: "name", "*": "name" });
    expect(["k", "name", "zz"].map((p) => at(schema, p))).toEqual(["name", "name", "name"]);
  });

  it("variants with different classes: the first variant in declaration order that gives one, as `piiPaths` lists it", () => {
    const schema = s.object({
      u: s.union("k", [
        s.object({ k: s.literal("a"), name: s.string() }),
        s.object({ k: s.literal("b"), name: s.string().pii("contact") }),
        s.object({ k: s.literal("c"), name: s.string() }).pii("special"),
      ]),
    });
    expect(listed(schema)).toEqual({ "u.name": "contact", "u.k": "special", "u.*": "special" });
    expect(["u.name", "u.k", "u.zz"].map((p) => at(schema, p))).toEqual(["contact", "special", "special"]);
  });

  it("a declared field wins over another variant's `*`; an undeclared one takes the open variant's class", () => {
    const schema = s.object({
      u: s.union("k", [
        s.object({ k: s.literal("a"), x: s.string() }).pii("location"),
        s.object({ k: s.literal("b"), name: s.string().pii("name") }, { closed: true }),
      ]),
    });
    expect(listed(schema)).toEqual({ "u.k": "location", "u.x": "location", "u.*": "location", "u.name": "name" });
    expect(["u.name", "u.x", "u.zz"].map((p) => at(schema, p))).toEqual(["name", "location", "location"]);
  });

  it("a nested union under a marked open object", () => {
    const schema = s.object({
      box: s
        .object({
          u: s.union("k", [
            s.object({ k: s.literal("a"), geo: s.object({ lat: s.number() }) }),
            s.object({ k: s.literal("b"), geo: s.object({ lat: s.number() }).pii("special") }),
          ]),
        })
        .pii("location"),
    });
    expect(listed(schema)).toEqual({
      "box.u.k": "location",
      "box.u.geo.lat": "location",
      "box.u.geo.*": "location",
      "box.u.*": "location",
      "box.*": "location",
    });
    expect(["box.u.geo.lat", "box.u.geo", "box.u.zz", "box.zz"].map((p) => at(schema, p))).toEqual([
      "location",
      "location",
      "location",
      "location",
    ]);
  });

  it("a nested union whose second variant is marked, under an unmarked object", () => {
    const schema = s.object({
      box: s.object({
        u: s.union("k", [
          s.object({ k: s.literal("a"), geo: s.object({ lat: s.number() }) }),
          s.object({ k: s.literal("b"), geo: s.object({ lat: s.number() }).pii("special") }),
        ]),
      }),
    });
    expect(listed(schema)).toEqual({ "box.u.geo.lat": "special", "box.u.geo.*": "special" });
    expect(["box.u.geo.lat", "box.u.geo", "box.u.geo.zz", "box.u.k"].map((p) => at(schema, p))).toEqual([
      "special",
      "special",
      "special",
      undefined,
    ]);
  });
});

describe("an undeclared key takes the class in force at its object, open or closed", () => {
  it("over-masks under a closed object, which no parsed value reaches", () => {
    const closed = s.object({ address: s.object({ street: s.string() }, { closed: true }).pii("location") });
    expect(listed(closed)).toEqual({ "address.street": "location" });
    expect(["address.floor", "address.floor.n"].map((p) => at(closed, p))).toEqual(["location", "location"]);
  });

  it("gives an open object's undeclared key and every path under it the object's class", () => {
    const open = s.object({ address: s.object({ street: s.string() }).pii("location") });
    expect(["address.floor", "address.floor.n"].map((p) => at(open, p))).toEqual(["location", "location"]);
  });

  it("gives no class where no mark is in force", () => {
    expect(at(s.object({ a: s.object({ b: s.string() }, { closed: true }) }), "a.zz")).toBeUndefined();
  });
});
