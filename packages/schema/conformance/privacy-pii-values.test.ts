// Spec: k.schema, Conformance "For every generated value of a fixture schema, `piiValues` returns exactly the non-empty strings and the numbers under marked paths."
// Seed: 1337.
// Skipped until `piiValues` exists. The spec does not say whether the result is an array or a set, or whether it repeats a value
// found twice: results are compared as distinct sorted strings.
import { piiValues, s } from "@keel/schema";
import { gen } from "@keel/schema/gen";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { RUNS, SEED, build, distinctSorted, expectedValues, markedRoot } from "./privacy-fixtures";

describe("k.privacy piiValues", () => {
  it("for every generated schema with marked nodes and every generated value, piiValues returns exactly the non-empty strings and the numbers under marked paths", () => {
    fc.assert(
      fc.property(
        markedRoot.chain((spec) => fc.tuple(fc.constant(spec), gen(build(spec)))),
        ([spec, value]) => {
          const schema = build(spec);
          const encoded = schema.encode(value);
          expect(distinctSorted(piiValues(schema, encoded))).toEqual(distinctSorted(expectedValues(spec, encoded)));
        },
      ),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it("a fixture schema yields its non-empty marked strings and its marked numbers as String(), and nothing unmarked, no boolean, no empty string", () => {
    const Fixture = s.object({
      name: s.string().pii("name"),
      nick: s.string().pii("name"),
      age: s.int(),
      balance: s.number().pii("financial"),
      visits: s.int().pii("identifier"),
      flag: s.boolean().pii("special"),
      notes: s.array(s.string()).pii("content"),
      plain: s.string(),
    });
    const value = {
      name: "Ada Lovelace",
      nick: "",
      age: 36,
      balance: 12.5,
      visits: 7,
      flag: true,
      notes: ["first", "", "second"],
      plain: "visible",
    };
    expect(Fixture.parse(value).ok).toBe(true);
    expect(distinctSorted(piiValues(Fixture, Fixture.encode(value)))).toEqual(
      distinctSorted(["Ada Lovelace", "12.5", "7", "first", "second"]),
    );
  });

  it("an undeclared key at any depth under a marked open object is personal: its names and values are held; the same value under an unmarked schema gives none (rfc:0154)", () => {
    const marked = s.object({
      address: s.object({ street: s.string(), geo: s.object({ lat: s.number() }).pii("special") }).pii("location"),
    });
    const plain = s.object({
      address: s.object({ street: s.string(), geo: s.object({ lat: s.number() }) }),
    });
    const value = { address: { street: "Elm", geo: { lat: 1 }, floor: { n: "3rd" } } };
    const held = piiValues(marked, value);
    for (const v of ["floor", "n", "3rd", "Elm", "1"]) expect(held).toContain(v);
    expect(piiValues(plain, value)).toEqual([]);
  });
});
