// Spec: k.schema, clause "`piiPaths` lists each marked leaf once with its class, an array item as `*`, and every leaf under a marked object, then `*` for its undeclared keys when it is open; a control bound (k.forms) to a declared object under it carries its nearest mark's class as `data-k-pii`." (rfc:0154; the `data-k-pii` half: packages/forms/conformance/pii-path-lookup.test.ts)
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
      { path: "address.geo.*", class: "location" },
      { path: "address.lines.*", class: "location" },
      { path: "address.*", class: "location" },
    ]);
  });

  const Nested = (closed: boolean) => {
    const opts = closed ? { closed: true as const } : undefined;
    return s.object({
      address: s
        .object(
          {
            street: s.string(),
            geo: s.object({ lat: s.number() }, opts).pii("special"),
          },
          opts,
        )
        .pii("location"),
    });
  };

  it("`address.street` (location), `address.geo.lat` (special), `address.geo.*` (special), `address.*` (location), in that order", () => {
    expect(listed(Nested(false))).toEqual([
      { path: "address.street", class: "location" },
      { path: "address.geo.lat", class: "special" },
      { path: "address.geo.*", class: "special" },
      { path: "address.*", class: "location" },
    ]);
  });

  it("a marked `{ closed: true }` object adds no `*`: only `address.street` and `address.geo.lat`", () => {
    expect(listed(Nested(true))).toEqual([
      { path: "address.street", class: "location" },
      { path: "address.geo.lat", class: "special" },
    ]);
  });

  it("a marked open root lists its leaves, then `*` last, with its class", () => {
    expect(listed(s.object({ name: s.string() }).pii("name"))).toEqual([
      { path: "name", class: "name" },
      { path: "*", class: "name" },
    ]);
  });

  it("an open object under no mark adds no `*`", () => {
    expect(listed(s.object({ a: s.object({ b: s.string().pii("name") }), c: s.string() }))).toEqual([
      { path: "a.b", class: "name" },
    ]);
  });

  // Spec: k.schema, Derivations "`piiPaths(schema)` lists `{ path, class }` per marked leaf in declaration order ... the class its nearest mark's" (rfc:0154 D4: the union rule is stated in the RFC and ADR-0176, the section has no room for it).
  it("`piiPaths` of a union with a marked variant is exactly `u.k` (`name`), `u.name` (`name`), `u.*` (`name`), in that order", () => {
    const schema = s.object({
      u: s.union("k", [
        s.object({ k: s.literal("a"), name: s.string() }),
        s.object({ k: s.literal("b"), name: s.string() }).pii("name"),
      ]),
    });
    expect(listed(schema)).toEqual([
      { path: "u.k", class: "name" },
      { path: "u.name", class: "name" },
      { path: "u.*", class: "name" },
    ]);
  });
});
