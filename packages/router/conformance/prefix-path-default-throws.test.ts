// Spec: k.prefix, clause "`s.enum(['en-US'], { pathDefault: 'fr-FR' })` throws." (rfc:0079) Seed 1337.
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

describe("k.prefix pathDefault", () => {
  test("s.enum(['en-US'], { pathDefault: 'fr-FR' }) throws", () => {
    expect(() => s.enum(["en-US"], { pathDefault: "fr-FR" })).toThrow();
  });

  test("a pathDefault that is one of the values does not throw; any other does", () => {
    const tag = fc.stringMatching(/^[a-z]{2}-[A-Z]{2}$/);
    fc.assert(
      fc.property(tag, fc.array(tag, { maxLength: 3 }), tag, (first, rest, d) => {
        const make = () => s.enum([first, ...rest], { pathDefault: d });
        if (d === first || rest.includes(d)) expect(make).not.toThrow();
        else expect(make).toThrow();
      }),
      { seed: 1337, numRuns: 100 },
    );
  });
});
