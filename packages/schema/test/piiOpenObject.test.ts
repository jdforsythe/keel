// A marked open object's undeclared keys: `piiValues` returns their names and values, so `piiPaths` must give a path
// that covers them, or a consumer redacting by path leaves them in the clear (k.schema Derivations).
import { describe, expect, it } from "vitest";
import { piiPaths, piiValues, s } from "../src/index.ts";

const Address = s.object({ name: s.string(), address: s.object({ street: s.string() }).pii("location") });
const value = { name: "n", address: { street: "Elm", floor: "3rd" } };

/** Whether dotted `pattern` (`*` any one segment) names `segs`. */
const covers = (pattern: string, segs: readonly string[]): boolean => {
  const parts = pattern.split(".");
  return parts.length === segs.length && parts.every((p, i) => p === "*" || p === segs[i]);
};

describe("piiPaths of a marked open object", () => {
  it("piiValues returns the undeclared key and its value", () => {
    expect(piiValues(Address, value)).toEqual(["Elm", "floor", "3rd"]);
  });

  it("a path covers the undeclared key, with the object's class, after its declared leaves", () => {
    const paths = piiPaths(Address);
    expect(paths).toEqual([
      { path: "address.street", class: "location" },
      { path: "address.*", class: "location" },
    ]);
    expect(paths.some((p) => covers(p.path, ["address", "floor"]))).toBe(true);
  });

  it("a closed marked object and an unmarked open one get no `*` path", () => {
    const Closed = s.object({ a: s.object({ b: s.string() }, { closed: true }).pii("contact") });
    const Plain = s.object({ a: s.object({ b: s.string().pii("contact") }) });
    expect(piiPaths(Closed)).toEqual([{ path: "a.b", class: "contact" }]);
    expect(piiPaths(Plain)).toEqual([{ path: "a.b", class: "contact" }]);
  });
});
