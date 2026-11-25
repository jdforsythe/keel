// k.schema registry: stdlib types register by name and are retrievable via the registry.
import { describe, expect, it } from "vitest";
import { s } from "@keel/schema";

describe("k.schema registry", () => {
  it("registry() returns a Map", () => {
    expect(s.registry()).toBeInstanceOf(Map);
  });
  it("register makes the schema retrievable by name", () => {
    const T = s.string({ min: 2 });
    s.register("conf.email", T);
    expect(s.registry().get("conf.email")).toBe(T);
  });
  it("registered schema still parses, encodes, and generates", () => {
    const T = s.int();
    s.register("conf.count", T);
    const got = s.registry().get("conf.count");
    expect(got?.parse(3).ok).toBe(true);
    expect(got?.parse(3.5).ok).toBe(false);
    expect(typeof got?.doc()).toBe("string");
  });
  it("unregistered name is absent", () => {
    expect(s.registry().has("conf.never-registered")).toBe(false);
  });
  it("multiple registrations coexist", () => {
    s.register("conf.a", s.boolean());
    s.register("conf.b", s.number());
    const r = s.registry();
    expect(r.has("conf.a")).toBe(true);
    expect(r.has("conf.b")).toBe(true);
  });
});
