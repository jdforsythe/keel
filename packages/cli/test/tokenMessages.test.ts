// E1807's place, message fit and `see` in `tokens.ts` (k.themes Token errors), beyond conformance. Seed 1337.
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { fitTokenMessage } from "../src/internal/fitTokenMessage.ts";
import { tokenKeyAt } from "../src/internal/tokenKeyAt.ts";
import { tokenSee } from "../src/internal/tokenSee.ts";

describe("fitTokenMessage", () => {
  it("keeps a message that fits whole", () => {
    expect(fitTokenMessage(["color", "a"], "a named color; write hex or a function form")).toBe(
      "color.a: a named color; write hex or a function form",
    );
  });

  it("drops leading segments behind one .../ before it cuts the last", () => {
    const what = "a print theme takes one value, not a pair";
    expect(fitTokenMessage(["themes", "paper", "color", "x".repeat(40)], what)).toBe(`.../${"x".repeat(40)}: ${what}`);
    expect(fitTokenMessage(["themes", "paper", "color", "x".repeat(80)], what)).toBe(
      `.../${"x".repeat(39)}...: ${what}`,
    );
  });

  it("never passes the bound and never cuts `: <what>`, whatever the path", () => {
    const seg = fc.string({ minLength: 1, maxLength: 60 });
    fc.assert(
      fc.property(
        fc.array(seg, { minLength: 1, maxLength: 6 }),
        fc.constantFrom("is no key here", "not a space value"),
        (path, what) => {
          const m = fitTokenMessage(path, what);
          expect(m.length).toBeLessThanOrEqual(89);
          expect(m.endsWith(`: ${what}`)).toBe(true);
        },
      ),
      { seed: 1337, numRuns: 200 },
    );
  });
});

describe("tokenKeyAt", () => {
  it("is at a key through defineTokens and satisfies, a quoted key at its quote", () => {
    const src = `import { defineTokens } from "@keel/ui/tokens";\nexport const tokens = defineTokens({\n  color: { "a.b": "red" },\n} satisfies object);\n`;
    expect(tokenKeyAt(src, ["color", "a.b"])).toEqual({ line: 3, col: 12 });
  });

  it("is at the last spread of the deepest object literal on the path, else the deepest key, else 1:1", () => {
    const src = `export const tokens = {\n  color: { ...a, ...b, text: "#000000" },\n};\n`;
    expect(tokenKeyAt(src, ["color", "ink"])).toEqual({ line: 2, col: 18 });
    expect(tokenKeyAt("export const tokens = { color: base };\n", ["color", "ink"])).toEqual({ line: 1, col: 25 });
    expect(tokenKeyAt("export const other = {};\n", ["color"])).toEqual({ line: 1, col: 1 });
  });

  it("follows a const of the same file", () => {
    const src = `const color = {\n  a: "red",\n};\nexport const tokens = { color };\n`;
    expect(tokenKeyAt(src, ["color", "a"])).toEqual({ line: 4, col: 25 });
  });
});

describe("tokenSee", () => {
  it("names the section of each rule", () => {
    expect(tokenSee("breakpoint takes no theme")).toBe("k.themes");
    expect(tokenSee("a second print theme")).toBe("k.themes");
    expect(tokenSee('is ["light"], ["dark"] or ["light", "dark"]')).toBe("k.schemes");
    expect(tokenSee("is no key here")).toBe("k.ui");
    expect(tokenSee("not a weight value")).toBe("k.values");
  });
});
