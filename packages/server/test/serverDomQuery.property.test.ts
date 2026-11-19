// @vitest-environment node
// Property (seed 1337, backlog 0156): for random nested trees built with the server DOM (elements, text, comments,
// templates, fragments; ids drawn from a small set, some with quotes and backslashes), `querySelector('[id="x"]')`
// (the form compiled templates emit, CSS-escaped) is the first element with that id in a pre-order walk of the
// root's descendants, `querySelectorAll` is every such element in order, and `#x` agrees when x is an ident.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { ServerDocument } from "../src/internal/dom/ServerDocument.ts";
import { ServerElement } from "../src/internal/dom/ServerElement.ts";
import type { ServerFragment } from "../src/internal/dom/ServerFragment.ts";
import type { ServerNode } from "../src/internal/dom/ServerNode.ts";
import { ServerTemplate } from "../src/internal/dom/ServerTemplate.ts";

const SEED = 1337;
const doc = new ServerDocument();
const IDS = ["x", "a.1", "y", 'q"u', "b\\s", "é"];

type Shape = { readonly tag: string; readonly id: string | null; readonly kids: readonly Shape[] } | string;
const shape: fc.Arbitrary<Shape> = fc.letrec<{ node: Shape }>((tie) => ({
  node: fc.oneof(
    { depthSize: "small", withCrossShrink: true },
    fc.string({ maxLength: 3 }),
    fc.record({
      tag: fc.constantFrom("div", "span", "template", "ul", "li", "input", "select", "option", "p"),
      id: fc.option(fc.constantFrom(...IDS), { nil: null }),
      kids: fc.array(tie("node"), { maxLength: 4 }),
    }),
  ),
})).node;

const build = (s: Shape): ServerNode => {
  if (typeof s === "string") return s.startsWith("!") ? doc.createComment(s) : doc.createTextNode(s);
  const el = doc.createElement(s.tag);
  if (s.id !== null) el.setAttribute("id", s.id);
  const into = el instanceof ServerTemplate ? el.content : el;
  for (const k of s.kids) into.appendChild(build(k));
  return el;
};

/** Reference: descendants of `root` in pre-order, never entering a template's content. */
const walk = (root: ServerNode): ServerElement[] =>
  root.childNodes.flatMap((c) => [...(c instanceof ServerElement ? [c] : []), ...walk(c)]);

const cssString = (v: string): string => `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

describe("server DOM querySelector agrees with a reference walk (seed 1337)", () => {
  it("[id=…], querySelectorAll and #id on element and fragment roots", () => {
    fc.assert(
      fc.property(fc.array(shape, { maxLength: 4 }), fc.constantFrom(...IDS), fc.boolean(), (kids, id, asFragment) => {
        const root: ServerElement | ServerFragment = asFragment
          ? doc.createDocumentFragment()
          : doc.createElement("div");
        for (const k of kids) root.appendChild(build(k));
        const want = walk(root).filter((e) => e.getAttribute("id") === id);
        expect(root.querySelector(`[id=${cssString(id)}]`)).toBe(want[0] ?? null);
        expect(root.querySelectorAll(`[id=${cssString(id)}]`)).toEqual(want);
        if (/^[a-z]+$/.test(id)) expect(root.querySelector(`#${id}`)).toBe(want[0] ?? null);
      }),
      { seed: SEED, numRuns: 300 },
    );
  });
});
