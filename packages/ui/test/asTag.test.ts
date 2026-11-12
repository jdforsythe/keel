// @vitest-environment happy-dom
// `Box as` and `Text as` are closed sets at runtime too (backlog 0123): a value outside the union, such as one
// spread from parsed JSON, throws before any element is created; every member renders its own tag. `Heading
// level` likewise takes only the integers 1-6 (backlog 0141).
import { Box, Heading, Text } from "@keel/ui";
import { describe, expect, it } from "vitest";

const BOX = ["div", "section", "nav", "main", "header", "footer", "aside", "article", "ul", "ol", "li"] as const;
const TEXT = ["span", "p", "strong", "em", "small", "code", "pre", "blockquote"] as const;
const tagName = (n: Node): string => (n instanceof Element ? n.localName : "");

describe("as is checked at runtime", () => {
  it("Box and Text render every tag in their set, and their defaults", () => {
    for (const as of BOX)
      expect(tagName(as === "nav" || as === "aside" ? Box({ as, label: "x" }) : Box({ as }))).toBe(as);
    for (const as of TEXT) expect(tagName(Text({ as }))).toBe(as);
    expect(tagName(Box({}))).toBe("div");
    expect(tagName(Text({}))).toBe("span");
  });

  it("a parsed-JSON as outside the set throws", () => {
    const bad = ['"img src=x onerror=alert(1) x"', '"script"', '"span"', '"DIV"', "null", "1", '["div"]'];
    for (const v of bad) {
      expect(() => Box({ ...JSON.parse(`{"as":${v}}`) }), v).toThrow(/k\.ui: Box as=/);
    }
    for (const v of ['"img"', '"div"', '"a href=x"']) {
      expect(() => Text({ ...JSON.parse(`{"as":${v}}`) }), v).toThrow(/k\.ui: Text as=/);
    }
  });

  it('backlog 0141: Heading level is 1-6 at runtime; "ead" is not <head>, "r" is not <hr>', () => {
    for (const level of [1, 2, 3, 4, 5, 6] as const)
      expect(tagName(Heading({ level, children: "t" }))).toBe(`h${level}`);
    for (const v of ['"ead"', '"r"', '"1"', "0", "7", "1.5", "null", '"1 onclick=x"']) {
      expect(() => Heading({ children: "t", ...JSON.parse(`{"level":${v}}`) }), v).toThrow(/k\.ui: Heading level=/);
    }
    expect(() => Heading({ children: "t", ...JSON.parse("{}") })).toThrow(/k\.ui: Heading level=undefined/);
  });
});
