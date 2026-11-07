// @vitest-environment happy-dom
// Spec: k.compiler, clause "A component with no dynamic expressions compiles to a single cloned template and no bindings."
// Seed 1337 (fc.assert seed below).
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import { mount } from "@keel/runtime-dom";
import fc from "fast-check";
import { expect, test } from "vitest";
import { isMountable } from "./support.ts";

const count = (code: string, re: RegExp) => (code.match(re) ?? []).length;

test("A component with no dynamic expressions compiles to a single cloned template and no bindings", () => {
  const tag = fc.constantFrom("div", "section", "p", "span", "ul");
  const word = fc.stringMatching(/^[a-z]{1,8}$/);
  fc.assert(
    fc.property(fc.array(fc.tuple(tag, word), { minLength: 1, maxLength: 6 }), (kids) => {
      const body = kids.map(([t, w]) => `<${t} class="${w}">${w}</${t}>`).join("");
      const r = compile([{ path: "S.tsx", source: `export default function S() { return <main>${body}</main> }` }]);
      expect(r.diagnostics).toEqual([]);
      const code = r.outputs[0]?.code ?? "";
      expect(count(code, /\btemplate\(/g)).toBe(1);
      expect(count(code, /\bclone\(/g)).toBe(1);
      expect(count(code, /\btext\(/g)).toBe(0);
      expect(count(code, /\battr\(/g)).toBe(0);
      expect(count(code, /\bprop\(/g)).toBe(0);
      expect(count(code, /\bon\(/g)).toBe(0);
    }),
    { seed: 1337, numRuns: 30 },
  );
});

interface Tree {
  tag: string;
  attrs: readonly (readonly [string, string])[];
  text: string;
  kids: readonly Tree[];
}

const treeArb: fc.Arbitrary<Tree> = fc.letrec<{ tree: Tree }>((tie) => ({
  tree: fc.record({
    tag: fc.constantFrom("div", "section", "span", "article", "aside"),
    attrs: fc.uniqueArray(
      fc.oneof(
        fc.tuple(fc.constant("class"), fc.stringMatching(/^[a-z]{1,8}$/)),
        fc.tuple(fc.constant("title"), fc.stringMatching(/^[a-z]{1,8}$/)),
        fc.tuple(fc.constant("href"), fc.constant("https://example.com")),
      ),
      { selector: (a) => a[0], maxLength: 3 },
    ),
    text: fc.oneof(fc.constant(""), fc.stringMatching(/^[a-z]{1,8}$/)),
    kids: fc.oneof({ maxDepth: 3 }, fc.constant([]), fc.array(tie("tree"), { maxLength: 3 })),
  }),
})).tree;

// Serialize the mounted DOM ignoring generated `id` attributes and comment markers.
function dom(n: Node): string {
  if (n.nodeType === 3) return n.textContent ?? "";
  if (!(n instanceof Element)) return "";
  const a = n
    .getAttributeNames()
    .filter((k) => k !== "id")
    .map((k) => ` ${k}="${n.getAttribute(k)}"`)
    .join("");
  const tag = n.tagName.toLowerCase();
  return `<${tag}${a}>${Array.from(n.childNodes).map(dom).join("")}</${tag}>`;
}

function html(t: Tree): string {
  const a = t.attrs.map(([k, v]) => ` ${k}="${v}"`).join("");
  return `<${t.tag}${a}>${t.text}${t.kids.map(html).join("")}</${t.tag}>`;
}

test("A component with no dynamic expressions compiles to one cloned template, no text/attr/prop/on bindings, and mounts the source structure", () => {
  fc.assert(
    fc.property(treeArb, (t) => {
      const markup = html(t);
      const r = compile([{ path: "S.tsx", source: `export default function S() { return ${markup} }` }]);
      expect(r.diagnostics).toEqual([]);
      const code = r.outputs[0]?.code ?? "";
      expect(count(code, /\btemplate\(/g)).toBe(1);
      expect(count(code, /\bclone\(/g)).toBe(1);
      for (const op of ["text", "attr", "prop", "on"]) expect(count(code, new RegExp(`\\b${op}\\(`, "g"))).toBe(0);
      const c = evaluate(code);
      if (!isMountable(c)) throw new Error("default export is not a component");
      const host = document.createElement("div");
      const dispose = mount(c, host);
      expect(Array.from(host.childNodes).map(dom).join("")).toBe(markup);
      dispose();
    }),
    { seed: 1337, numRuns: 50 },
  );
});
