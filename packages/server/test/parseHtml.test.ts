// @vitest-environment node
// parseHtml (the server DOM's `innerHTML` and compiler-hoisted templates): the node tree it builds, read back as plain
// data so a case holds the tree's exact shape. Each case loads a fresh copy of the module graph, so the parser's
// patterns are built inside the case.
import { describe, expect, it, vi } from "vitest";

type Shape = string | { readonly tag: string; readonly attrs?: Record<string, string>; readonly kids?: Shape[] };

async function parse(html: string): Promise<Shape[]> {
  vi.resetModules();
  const { ServerDocument } = await import("../src/internal/dom/ServerDocument.ts");
  const { ServerElement } = await import("../src/internal/dom/ServerElement.ts");
  const { ServerText } = await import("../src/internal/dom/ServerText.ts");
  const { ServerComment } = await import("../src/internal/dom/ServerComment.ts");
  const { ServerNode } = await import("../src/internal/dom/ServerNode.ts");
  const { parseHtml } = await import("../src/internal/dom/parseHtml.ts");
  const doc = new ServerDocument();
  const shape = (n: InstanceType<typeof ServerNode>): Shape => {
    if (n instanceof ServerComment) return `comment:${n.data}`;
    if (n instanceof ServerText) return `text:${n.data}`;
    if (!(n instanceof ServerElement)) return "other";
    const attrs = Object.fromEntries(n.attributeEntries());
    const kids = n.contentNodes().map(shape);
    return {
      tag: n.localName,
      ...(Object.keys(attrs).length > 0 ? { attrs } : {}),
      ...(kids.length > 0 ? { kids } : {}),
    };
  };
  const into = doc.createDocumentFragment();
  parseHtml(doc, html, into);
  return into.childNodes.map(shape);
}
const el = (tag: string, kids?: Shape[], attrs?: Record<string, string>): Shape => ({
  tag,
  ...(attrs === undefined ? {} : { attrs }),
  ...(kids === undefined ? {} : { kids }),
});

describe("parseHtml text and comments", () => {
  it("gives no node for an empty string and one text node for plain text", async () => {
    expect(await parse("")).toEqual([]);
    expect(await parse("hello")).toEqual(["text:hello"]);
    expect(await parse("a < b")).toEqual(["text:a < b"]);
    expect(await parse("1<2 and <3>")).toEqual(["text:1<2 and <3>"]);
    expect(await parse("a</div foo>b")).toEqual(["text:a</div foo>b"]);
  });

  it("decodes character references in text", async () => {
    expect(await parse("a &amp; b &lt;&gt; &quot;&apos; &#65;&#x42;")).toEqual([`text:a & b <> "' AB`]);
  });

  it("reads comments, empty and multi-line ones included, between text", async () => {
    expect(await parse("<!--c-->")).toEqual(["comment:c"]);
    expect(await parse("<!---->")).toEqual(["comment:"]);
    expect(await parse("a<!-- x  y -->b")).toEqual(["text:a", "comment: x  y ", "text:b"]);
    expect(await parse("<!--a\nb<i>-->")).toEqual(["comment:a\nb<i>"]);
    expect(await parse("<!--a--><!--b-->")).toEqual(["comment:a", "comment:b"]);
  });
});

describe("parseHtml elements", () => {
  it("builds nested elements with lowercased names and text in order", async () => {
    expect(await parse("<div>x<span>y</span>z</div>w")).toEqual([
      el("div", ["text:x", el("span", ["text:y"]), "text:z"]),
      "text:w",
    ]);
    expect(await parse("<DIV>x</Div>y")).toEqual([el("div", ["text:x"]), "text:y"]);
    expect(await parse("<BR>x<IMG>y")).toEqual([el("br"), "text:x", el("img"), "text:y"]);
    expect(await parse("<a><b></b><c></c></a>")).toEqual([el("a", [el("b"), el("c")])]);
    expect(await parse("<svg:rect></svg:rect>")).toEqual([el("svg:rect")]);
  });

  it("closes an element at its closing tag, with spaces before `>`, and the innermost match wins", async () => {
    expect(await parse("<p>a</p >b")).toEqual([el("p", ["text:a"]), "text:b"]);
    expect(await parse("<b><i><b>x</b>y</b>z</i>")).toEqual([
      el("b", [el("i", [el("b", ["text:x"]), "text:y"])]),
      "text:z",
    ]);
    expect(await parse("<b><i>x</b>y")).toEqual([el("b", [el("i", ["text:x"])]), "text:y"]);
  });

  it("ignores a closing tag with no open element, whatever precedes it", async () => {
    expect(await parse("</p>")).toEqual([]);
    expect(await parse("a</p>b")).toEqual(["text:a", "text:b"]);
    expect(await parse("<a>x</b>y</a>")).toEqual([el("a", ["text:x", "text:y"])]);
  });

  it("keeps a void element childless and gives its following text to the parent", async () => {
    expect(await parse("<p>a<br>b<img src=x>c<input>d</p>")).toEqual([
      el("p", ["text:a", el("br"), "text:b", el("img", undefined, { src: "x" }), "text:c", el("input"), "text:d"]),
    ]);
    for (const tag of ["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"])
      expect(await parse(`<${tag}>x`), tag).toEqual([el(tag), "text:x"]);
  });

  it("treats a trailing slash as self-closing, a slash elsewhere as not", async () => {
    expect(await parse("<div/>x")).toEqual([el("div"), "text:x"]);
    expect(await parse("<div />x")).toEqual([el("div"), "text:x"]);
    expect(await parse('<span class="a"/>x')).toEqual([el("span", undefined, { class: "a" }), "text:x"]);
    expect(await parse("<div / >x")).toEqual([el("div"), "text:x"]);
    expect(await parse("<a/b>x</a>")).toEqual([el("a", ["text:x"], { b: "" })]);
    expect(await parse("<a b/c>x</a>")).toEqual([el("a", ["text:x"], { b: "", c: "" })]);
  });

  it("puts a template's children in its content, not in its children", async () => {
    expect(await parse("<template><p>x</p></template>y")).toEqual([el("template", [el("p", ["text:x"])]), "text:y"]);
    expect(await parse("<template><template><i></i></template></template>")).toEqual([
      el("template", [el("template", [el("i")])]),
    ]);
  });
});

describe("parseHtml attributes", () => {
  it("reads double-quoted, single-quoted, unquoted and valueless attributes", async () => {
    expect(await parse(`<a href="x" data-y='z' w=v disabled>t</a>`)).toEqual([
      el("a", ["text:t"], { href: "x", "data-y": "z", w: "v", disabled: "" }),
    ]);
    expect(await parse(`<a b = "c" d= 'e' f =g>`)).toEqual([el("a", undefined, { b: "c", d: "e", f: "g" })]);
    expect(await parse(`<a b="" c=''>`)).toEqual([el("a", undefined, { b: "", c: "" })]);
  });

  it("keeps `>`, the other quote and spaces inside a quoted value, and decodes references in it", async () => {
    expect(await parse(`<a title="x>y" alt='say "hi"' c="it's">z</a>`)).toEqual([
      el("a", ["text:z"], { title: "x>y", alt: 'say "hi"', c: "it's" }),
    ]);
    expect(await parse(`<a title="a b  c" d="a&amp;b &lt;">`)).toEqual([el("a", undefined, { title: "a b  c", d: "a&b <" })]);
    expect(await parse(`<a b=c&amp;d>`)).toEqual([el("a", undefined, { b: "c&d" })]);
  });

  it("ends an unquoted value at whitespace and keeps the attributes after it", async () => {
    expect(await parse("<a b=c d=e\tf=g\nh>")).toEqual([el("a", undefined, { b: "c", d: "e", f: "g", h: "" })]);
  });

  it("throws on a tag or attribute name the server DOM refuses", async () => {
    await expect(parse("<div 1a=x>")).rejects.toThrow(/invalid attribute name/);
  });
});

describe("parseHtml raw text", () => {
  it("reads script and style text as one raw text node, tags and references untouched", async () => {
    expect(await parse("<script>if (a<b && c) { x = '</b>' }</script>after")).toEqual([
      el("script", ["text:if (a<b && c) { x = '</b>' }"]),
      "text:after",
    ]);
    expect(await parse("<style>a > b &amp; <i></i></style><p>c</p>")).toEqual([
      el("style", ["text:a > b &amp; <i></i>"]),
      el("p", ["text:c"]),
    ]);
    expect(await parse('<script src="a.js" async></script>')).toEqual([el("script", undefined, { src: "a.js", async: "" })]);
  });

  it("matches the closing tag in any letter case and allows spaces before its `>`", async () => {
    expect(await parse("<SCRIPT>x</SCRIPT>y")).toEqual([el("script", ["text:x"]), "text:y"]);
    expect(await parse("<script>x</script >y")).toEqual([el("script", ["text:x"]), "text:y"]);
    expect(await parse("<script>x</SCRIPT\n>y")).toEqual([el("script", ["text:x"]), "text:y"]);
  });

  it("has no text node for an empty script, and runs an unclosed one to the end", async () => {
    expect(await parse("<script></script>x")).toEqual([el("script"), "text:x"]);
    expect(await parse("<style></style>")).toEqual([el("style")]);
    expect(await parse("<script>abc")).toEqual([el("script", ["text:abc"])]);
    expect(await parse("<script>")).toEqual([el("script")]);
    expect(await parse("<script>abc</script")).toEqual([el("script", ["text:abc"])]);
    expect(await parse("<p><script>a</script>b</p>c")).toEqual([el("p", [el("script", ["text:a"]), "text:b"]), "text:c"]);
  });

  it("reads two raw elements in a row", async () => {
    expect(await parse("<script>a</script><style>b</style>")).toEqual([el("script", ["text:a"]), el("style", ["text:b"])]);
    expect(await parse("<script>a</script><script>b</script>")).toEqual([el("script", ["text:a"]), el("script", ["text:b"])]);
  });
});

describe("parseHtml leading newline", () => {
  it("drops one newline right after pre, textarea or listing, LF or CRLF", async () => {
    for (const tag of ["pre", "textarea", "listing"]) {
      expect(await parse(`<${tag}>\nabc</${tag}>`), tag).toEqual([el(tag, ["text:abc"])]);
      expect(await parse(`<${tag}>\r\nabc</${tag}>`), tag).toEqual([el(tag, ["text:abc"])]);
      expect(await parse(`<${tag}>\n\nabc</${tag}>`), tag).toEqual([el(tag, ["text:\nabc"])]);
      expect(await parse(`<${tag}>a\nb</${tag}>`), tag).toEqual([el(tag, ["text:a\nb"])]);
      expect(await parse(`<${tag}>abc\n</${tag}>`), tag).toEqual([el(tag, ["text:abc\n"])]);
      expect(await parse(`<${tag}>\n</${tag}>`), tag).toEqual([el(tag)]);
    }
  });

  it("keeps the newline after other elements and after names that only contain those names", async () => {
    expect(await parse("<div>\nabc</div>")).toEqual([el("div", ["text:\nabc"])]);
    expect(await parse("<xpre>\nabc</xpre>")).toEqual([el("xpre", ["text:\nabc"])]);
    expect(await parse("<prex>\nabc</prex>")).toEqual([el("prex", ["text:\nabc"])]);
    expect(await parse("<pre>\nabc</pre>\ndef")).toEqual([el("pre", ["text:abc"]), "text:\ndef"]);
    expect(await parse("<pre>\r")).toEqual([el("pre", ["text:\r"])]);
  });
});
