// TokenSchema's first-issue message `<path>: <what>` (k.themes Token errors), beyond conformance. Seed 1337.
import { TokenSchema, defineTokens } from "@keel/ui/tokens";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

const messageOf = (tokens: unknown): string => {
  const r = TokenSchema.parse(tokens);
  return r.ok ? "" : r.error.message;
};

describe("TokenSchema messages", () => {
  it("words each refusal of the closed list", () => {
    expect(messageOf({ themes: { dark: {} } })).toBe("themes.dark: default, system, light and dark are reserved");
    expect(messageOf({ themes: { "1a": {} } })).toBe(
      "themes.1a: a theme name is a letter then up to 23 letters and digits",
    );
    expect(messageOf({ themes: { a: { motion: {} } } })).toBe("themes.a.motion: motion takes no theme");
    expect(messageOf({ themes: { a: { nope: {} } } })).toBe("themes.a.nope: is no key here");
    expect(messageOf({ color: { a: "hsl(1, 2%, 3%)" } })).toBe("color.a: channels are separated by spaces, not commas");
    expect(messageOf({ color: { a: { light: "#000000", dark: "blue" } } })).toBe(
      "color.a.dark: a named color; write hex or a function form",
    );
    expect(messageOf({ color: { a: "#000" }, overlay: { s: { value: "#00000080", over: ["a", "a"] } } })).toBe(
      "overlay.s.over: holds 1 to 8 distinct names",
    );
    expect(messageOf({ weight: { a: "heavy" } })).toBe("weight.a: not a weight value");
  });

  it("puts a count past its bound at the later theme", () => {
    expect(messageOf({ themes: { a: { when: "print" }, b: {}, c: { when: "print" } } })).toBe(
      "themes.c: a second print theme",
    );
  });

  it("defineTokens throws E1807 with the message and the issues", () => {
    let thrown: unknown;
    try {
      defineTokens({ space: { a: "-1px" } });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toMatchObject({ code: "E1807", message: "space.a: not a space value" });
    expect(Reflect.get(Object(thrown), "issues")).toEqual([{ path: ["space", "a"], rule: "format" }]);
  });

  it("names the first refusal for any number of choice themes past 8", () => {
    fc.assert(
      fc.property(fc.integer({ min: 9, max: 20 }), (n) => {
        const themes = Object.fromEntries(Array.from({ length: n }, (_, i) => [`t${i + 1}`, {}]));
        expect(messageOf({ themes })).toBe("themes.t9: a ninth choice theme; at most 8");
      }),
      { seed: 1337, numRuns: 12 },
    );
  });
});
