// formatLiteral over a fixture format (the stdlib formats' cases are in std-text's conformance). Seed 1337.
import fc from "fast-check";
import { expect, it } from "vitest";
import { formatLiteral, s } from "../src/index.ts";

const Even = s.format("fixture.evenLength", s.string(), {
  check: (v) => v.length % 2 === 0,
  gen: { from: s.string({ max: 8 }), map: (t) => t.slice(0, t.length - (t.length % 2)) },
});
const call = (text: string): unknown => Reflect.apply(formatLiteral, undefined, [Even, text]);

it("returns the text when the format's parse accepts it, and throws a TypeError naming the format and the rule when it does not", () => {
  fc.assert(
    fc.property(fc.string({ maxLength: 12 }), (text) => {
      if (Even.parse(text).ok) {
        expect(call(text)).toBe(text);
        return;
      }
      try {
        call(text);
        expect.unreachable("formatLiteral did not throw");
      } catch (e) {
        expect(e).toBeInstanceOf(TypeError);
        if (e instanceof TypeError) {
          expect(e.message).toContain("fixture.evenLength");
          expect(e.message).toContain("format");
        }
      }
    }),
    { seed: 1337, numRuns: 100 },
  );
});

it("a literal types as the format's brand", () => {
  const v: s.infer<typeof Even> = formatLiteral(Even, "ab");
  expect(v).toBe("ab");
});
