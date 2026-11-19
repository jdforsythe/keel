// @vitest-environment node
// Property (seed 1337, backlog 0167): `cloneNode(true)` over random trees built from every server element class
// (plain, template, input, select, textarea, option, button, fieldset) gives each copied node the original's
// constructor, attributes and serialization, and a template's content is cloned the same way. A cloned button's
// `value` property reflects its attribute, as in a browser.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { ServerControl } from "../src/internal/dom/ServerControl.ts";
import { ServerDocument } from "../src/internal/dom/ServerDocument.ts";
import { ServerElement } from "../src/internal/dom/ServerElement.ts";
import type { ServerNode } from "../src/internal/dom/ServerNode.ts";
import { ServerTemplate } from "../src/internal/dom/ServerTemplate.ts";

const SEED = 1337;
const doc = new ServerDocument();
const TAGS = ["div", "template", "input", "select", "textarea", "option", "button", "fieldset", "span"];

type Shape =
  | string
  | { readonly tag: string; readonly attrs: readonly (readonly [string, string])[]; readonly kids: readonly Shape[] };
const shape: fc.Arbitrary<Shape> = fc.letrec<{ node: Shape }>((tie) => ({
  node: fc.oneof(
    { depthSize: "small", withCrossShrink: true },
    fc.string({ maxLength: 3 }),
    fc.record({
      tag: fc.constantFrom(...TAGS),
      attrs: fc.array(
        fc.tuple(fc.constantFrom("value", "checked", "name", "type", "selected", "id"), fc.string({ maxLength: 4 })),
        {
          maxLength: 3,
        },
      ),
      kids: fc.array(tie("node"), { maxLength: 3 }),
    }),
  ),
})).node;

const build = (s: Shape): ServerNode => {
  if (typeof s === "string") return doc.createTextNode(s);
  const el = doc.createElement(s.tag);
  for (const [n, v] of s.attrs) el.setAttribute(n, v);
  const into = el instanceof ServerTemplate ? el.content : el;
  for (const k of s.kids) into.appendChild(build(k));
  return el;
};

/** `outerHTML`, or the refusal's message (text-only content holding its own end tag throws, k.server). */
const html = (el: ServerElement): string => {
  try {
    return el.outerHTML;
  } catch (e) {
    return String(e);
  }
};

const same = (a: ServerNode, b: ServerNode): void => {
  expect(b).not.toBe(a);
  expect(b.constructor).toBe(a.constructor);
  if (a instanceof ServerElement && b instanceof ServerElement) {
    expect([...b.attributeEntries()]).toEqual([...a.attributeEntries()]);
    expect(html(b)).toBe(html(a));
  }
  if (a instanceof ServerTemplate && b instanceof ServerTemplate) same(a.content, b.content);
  expect(b.childNodes.length).toBe(a.childNodes.length);
  a.childNodes.forEach((c, i) => {
    const d = b.childNodes[i];
    if (d === undefined) throw new Error(`missing child ${i}`);
    same(c, d);
  });
};

describe("cloneNode keeps every server element's class and attributes (seed 1337)", () => {
  it("cloneNode(true) over random trees of every element class", () => {
    fc.assert(
      fc.property(shape, (s) => {
        const node = build(s);
        same(node, node.cloneNode(true));
      }),
      { seed: SEED, numRuns: 300 },
    );
  });

  it("a cloned button is a control whose value reflects the attribute", () => {
    const b = doc.createElement("button");
    b.setAttribute("value", "delete");
    const copy = b.cloneNode(true);
    expect(copy).toBeInstanceOf(ServerControl);
    expect(Reflect.get(copy, "value")).toBe("delete");
    Reflect.set(copy, "value", "keep");
    expect(copy.outerHTML).toBe('<button value="keep"></button>');
  });
});
