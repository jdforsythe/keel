// @vitest-environment node
// Property (seed 1337, backlog 0166, rfc:0062): for any string, an `Input`, `TextArea` and `Select` rendered on the
// server DOM write it into their markup so that parsing that markup back with the server DOM parser gives a control
// whose value is the same string: escaping in attributes and text never loses or adds a character, and a textarea's
// leading newline is written twice because the parser drops the first (backlog 0179).
import { signal } from "@keel/reactive";
import { Input, Select, TextArea } from "@keel/ui";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { installServerDom } from "../src/internal/dom/installServerDom.ts";
import { renderUnit } from "../src/internal/renderUnit.ts";

const SEED = 1337;
// Any UTF-16 text, markup characters and quotes weighted in.
const text = fc.oneof(
  fc.fullUnicodeString(),
  fc.stringOf(fc.constantFrom("<", ">", "&", '"', "'", "/", "a", "\n", " ")),
);

const outer = (n: unknown): string => {
  const html = typeof n === "object" && n !== null ? Reflect.get(n, "outerHTML") : undefined;
  if (typeof html !== "string") throw new Error("fixture: not an element");
  return html;
};

const reparsed = (html: string, selector: string): unknown => {
  const holder = document.createElement("div");
  holder.innerHTML = html;
  return holder.querySelector(selector);
};

describe("a textarea value starting with a newline survives the parser's dropped first newline (backlog 0179, seed 1337)", () => {
  it("TextArea text and a pre's text round-trip for values starting with \\n, \\r\\n or \\r", () => {
    installServerDom();
    fc.assert(
      fc.property(fc.constantFrom("\n", "\r\n", "\r", "\n\n"), text, (lead, rest) => {
        const v = `${lead}${rest}`;
        const area = outer(renderUnit(() => TextArea({ label: "L", value: signal(v) })));
        expect(area).toMatch(/<textarea[^>]*>\n[\r\n]/);
        expect(Reflect.get(Object(reparsed(area, "textarea")), "value")).toBe(v);
        const pre = document.createElement("pre");
        pre.textContent = v;
        expect(Reflect.get(Object(reparsed(pre.outerHTML, "pre")), "textContent")).toBe(v);
      }),
      { seed: SEED, numRuns: 200 },
    );
  });

  it("one newline after <textarea> in parsed HTML is not content; text without one is unchanged", () => {
    installServerDom();
    expect(Reflect.get(Object(reparsed("<textarea>\nx</textarea>", "textarea")), "value")).toBe("x");
    expect(Reflect.get(Object(reparsed("<textarea>\r\nx</textarea>", "textarea")), "value")).toBe("x");
    expect(Reflect.get(Object(reparsed("<textarea>x\n</textarea>", "textarea")), "value")).toBe("x\n");
    expect(outer(renderUnit(() => TextArea({ label: "L", value: signal("x") })))).toMatch(
      /<textarea[^>]*>x<\/textarea>/,
    );
  });
});

describe("server-rendered control values round-trip through the server DOM parser (seed 1337)", () => {
  it("Input value attribute, TextArea text and Select selected option", () => {
    installServerDom();
    fc.assert(
      fc.property(text, text, (v, other) => {
        fc.pre(v !== other);
        const input = outer(renderUnit(() => Input({ label: "L", value: signal(v) })));
        expect(Reflect.get(Object(reparsed(input, "input")), "value")).toBe(v);
        const area = outer(renderUnit(() => TextArea({ label: "L", value: signal(v) })));
        expect(Reflect.get(Object(reparsed(area, "textarea")), "value")).toBe(v);
        const options = [
          { value: other, label: "other" },
          { value: v, label: "v" },
        ];
        const select = outer(renderUnit(() => Select({ label: "L", value: signal(v), options })));
        expect(Reflect.get(Object(reparsed(select, "select")), "value")).toBe(v);
      }),
      { seed: SEED, numRuns: 200 },
    );
  });
});
