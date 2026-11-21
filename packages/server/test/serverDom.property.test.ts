// @vitest-environment node
// Property (seed 1337): for any strings, building an element with createElement/setAttribute either throws
// InvalidCharacterError or serializes to HTML that parseHtml reads back as that one element with those
// attributes and nothing else; comment data and script/style text never end their node early (backlog 0123),
// also as sequences of text and comment children and under svg (backlog 0140).
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { ServerComment } from "../src/internal/dom/ServerComment.ts";
import { ServerDocument } from "../src/internal/dom/ServerDocument.ts";
import { ServerElement } from "../src/internal/dom/ServerElement.ts";
import type { ServerNode } from "../src/internal/dom/ServerNode.ts";
import { ServerText } from "../src/internal/dom/ServerText.ts";
import { parseHtml } from "../src/internal/dom/parseHtml.ts";

const SEED = 1337;
const doc = new ServerDocument();
const tricky = fc.constantFrom(
  "a",
  "Z",
  "1",
  "-",
  "_",
  ".",
  ":",
  " ",
  "\t",
  '"',
  "'",
  "<",
  ">",
  "/",
  "=",
  "`",
  "é",
  "!",
);
const name = fc.oneof(fc.string({ maxLength: 8 }), fc.stringOf(tricky, { maxLength: 8 }), fc.constantFrom("img", "br"));
const text = fc.oneof(
  fc.string({ maxLength: 20 }),
  fc.stringOf(fc.constantFrom("-", ">", "<", "!", "/", "script", "SCRIPT", "style", "x", " "), { maxLength: 12 }),
);

const reparse = (html: string): ServerNode[] => {
  const frag = doc.createDocumentFragment();
  parseHtml(doc, html, frag);
  return frag.childNodes;
};

const build = (tag: string, attrs: readonly (readonly [string, string])[]): string | Error => {
  try {
    const el = doc.createElement(tag);
    for (const [n, v] of attrs) el.setAttribute(n, v);
    return el.outerHTML;
  } catch (e) {
    return e instanceof Error ? e : new Error(String(e));
  }
};

describe("server DOM serialization round trip", () => {
  it("createElement/setAttribute throw or round-trip through parseHtml as one element", () => {
    fc.assert(
      fc.property(name, fc.array(fc.tuple(name, fc.string({ maxLength: 12 })), { maxLength: 4 }), (tag, attrs) => {
        const out = build(tag, attrs);
        if (out instanceof Error) {
          expect(out.name).toBe("InvalidCharacterError");
          return;
        }
        const nodes = reparse(out);
        expect(nodes).toHaveLength(1);
        const el = nodes[0];
        if (!(el instanceof ServerElement)) throw new Error(`not one element: ${out}`);
        expect(el.localName).toBe(tag.toLowerCase());
        expect(el.childNodes).toHaveLength(0);
        const want = new Map(attrs.map(([n, v]) => [n.toLowerCase(), v]));
        expect(new Map(el.attributeEntries())).toEqual(want);
      }),
      { seed: SEED, numRuns: 500 },
    );
  });

  it("any comment data re-parses as exactly one comment, well-formed for XML", () => {
    fc.assert(
      fc.property(text, (data) => {
        const host = doc.createElement("div");
        host.appendChild(doc.createComment(data));
        const nodes = reparse(host.innerHTML);
        expect(nodes).toHaveLength(1);
        const c = nodes[0];
        if (!(c instanceof ServerComment)) throw new Error(`not one comment: ${host.innerHTML}`);
        expect(c.data).not.toMatch(/--|^-?>|-$/);
        if (!/--|^-?>|-$/.test(data)) expect(c.data).toBe(data);
      }),
      { seed: SEED, numRuns: 500 },
    );
  });

  it("any text and comment children of script, style, svg style or svg script stay inside one element", () => {
    const kid = fc.tuple(fc.constantFrom("text", "comment"), text);
    fc.assert(
      fc.property(
        fc.constantFrom("script", "style", "svg>style", "svg>script"),
        fc.array(kid, { maxLength: 5 }),
        (path, kids) => {
          const tags = path.split(">");
          const root = doc.createElement(tags[0] ?? "div");
          const host = tags.length > 1 ? root.appendChild(doc.createElement(tags[1] ?? "div")) : root;
          for (const [kind, v] of kids)
            host.appendChild(kind === "text" ? doc.createTextNode(v) : doc.createComment(v));
          const joined = kids
            .filter(([kind]) => kind === "text")
            .map(([, v]) => v)
            .join("");
          if (path === "style" && /<\/style/i.test(joined)) {
            expect(() => root.outerHTML).toThrow(/<style> text contains/);
            return;
          }
          const html = root.outerHTML;
          const nodes = reparse(html);
          expect(nodes, html).toHaveLength(1);
          const back = nodes[0];
          if (!(back instanceof ServerElement)) throw new Error(`not one element: ${html}`);
          expect(back.localName).toBe(tags[0]);
          const inner = tags.length > 1 ? back.children : [back];
          expect(inner, html).toHaveLength(1);
          const el = inner[0];
          if (el === undefined) throw new Error(`no ${path}: ${html}`);
          expect(el.localName).toBe(tags[tags.length - 1]);
          expect(
            el.childNodes.filter((c) => !(c instanceof ServerText)),
            html,
          ).toHaveLength(0);
          if (path === "style") expect(el.textContent).toBe(joined);
        },
      ),
      { seed: SEED, numRuns: 500 },
    );
  });
});
