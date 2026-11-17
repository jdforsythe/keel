// Spec: k.schema, Conformance "`piiPaths` lists each marked leaf once with its class, an array item as `*`, and every leaf under a marked object."
// Seed: 1337.
// Skipped until `piiPaths` exists. Path text is compared dotted: the spec does not say whether `path` is a string or segments.
import { piiPaths, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { RUNS, SEED, build, dotted, expectedPaths, markedRootExclusive } from "./privacy-fixtures";

const listed = (schema: Parameters<typeof piiPaths>[0]) =>
  piiPaths(schema).map((e) => ({ path: dotted(e.path), class: e.class }));

describe("k.privacy piiPaths", () => {
  it("for every generated schema, piiPaths lists each marked leaf once with its class, in declaration order, an array item as `*`", () => {
    fc.assert(
      fc.property(markedRootExclusive, (spec) => {
        expect(listed(build(spec))).toEqual(expectedPaths(spec));
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it("a marked leaf and a marked array item are listed with their class, the item as `*`, in declaration order", () => {
    const schema = s.object({
      id: s.int(),
      email: s.string().pii("contact"),
      tags: s.array(s.string().pii("content")),
      plain: s.string(),
    });
    expect(listed(schema)).toEqual([
      { path: "email", class: "contact" },
      { path: "tags.*", class: "content" },
    ]);
  });

  it("every leaf under a marked object is listed once with the object's class", () => {
    const schema = s.object({
      name: s.string(),
      address: s
        .object({
          street: s.string(),
          geo: s.object({ lat: s.number(), lng: s.number() }),
          lines: s.array(s.string()),
        })
        .pii("location"),
    });
    expect(listed(schema)).toEqual([
      { path: "address.street", class: "location" },
      { path: "address.geo.lat", class: "location" },
      { path: "address.geo.lng", class: "location" },
      { path: "address.lines.*", class: "location" },
    ]);
  });
});
