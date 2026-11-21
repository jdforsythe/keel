// @vitest-environment node
// Server DOM names and raw text (backlog 0123, red-team H1): invalid element and attribute names throw as in a
// browser, comment data cannot close its comment, `script`/`style` text cannot close its element, and a `Box`
// spread from parsed JSON cannot render a tag of its own.
import { Box } from "@keel/ui";
import { describe, expect, it } from "vitest";
import { ServerDocument } from "../src/internal/dom/ServerDocument.ts";
import { ServerFragment } from "../src/internal/dom/ServerFragment.ts";
import { installServerDom } from "../src/internal/dom/installServerDom.ts";
import { parseHtml } from "../src/internal/dom/parseHtml.ts";
import { toHtml } from "../src/internal/toHtml.ts";

const doc = new ServerDocument();

describe("server DOM names", () => {
  it("backlog 0123 repro: Box as from parsed JSON throws instead of rendering an onerror tag", () => {
    installServerDom();
    expect(() => toHtml(Box({ ...JSON.parse('{"as":"img src=x onerror=alert(1) x"}') }))).toThrow(/Box as=/);
  });

  it("createElement and createElementNS throw InvalidCharacterError on invalid names", () => {
    for (const name of ["img src=x", "", "1a", "a>b", "a/b", 'a"b', "a'b", "a=b", "a<b", "-a", "a\tb", "é"]) {
      expect(() => doc.createElement(name), name).toThrow(expect.objectContaining({ name: "InvalidCharacterError" }));
      expect(() => doc.createElementNS(null, name), name).toThrow(/k\.server: invalid element name/);
    }
  });

  it("accepts XML-name element names and keeps them lowercase", () => {
    for (const name of ["div", "my-el", "a.b", "svg:rect", "H1", "x_1"]) {
      expect(doc.createElement(name).outerHTML).toBe(`<${name.toLowerCase()}></${name.toLowerCase()}>`);
    }
  });

  it("setAttribute throws on invalid names and accepts data-, aria-, xlink: and _ names", () => {
    const el = doc.createElement("div");
    for (const name of ["src=x onerror", "x y", "", "a>", "a/", '"a', "'a", "=a", "<a", "1a", "-a"]) {
      expect(() => el.setAttribute(name, "v"), name).toThrow(/k\.server: invalid attribute name/);
    }
    for (const name of ["data-k", "aria-label", "xlink:href", "_x", ":x", "a.b"]) el.setAttribute(name, "v");
    expect(el.outerHTML).toBe('<div data-k="v" aria-label="v" xlink:href="v" _x="v" :x="v" a.b="v"></div>');
  });

  it("parseHtml refuses an invalid attribute name rather than serializing it", () => {
    expect(() => parseHtml(doc, "<div a`b=1></div>", doc.createDocumentFragment())).toThrow(/invalid attribute/);
  });
});

describe("server DOM comments", () => {
  const serialize = (data: string): string => {
    const el = doc.createElement("div");
    el.appendChild(doc.createComment(data));
    return el.innerHTML;
  };

  it("escapes data that would close the comment early", () => {
    expect(serialize("--><img src=x onerror=alert(1)>")).toBe("<!--- -><img src=x onerror=alert(1)>-->");
    expect(serialize("a--!>b")).toBe("<!--a- -!>b-->");
    expect(serialize(">x")).toBe("<!-- >x-->");
    expect(serialize("->x")).toBe("<!-- ->x-->");
    expect(serialize("x-")).toBe("<!--x- -->");
    expect(serialize("---")).toBe("<!--- - - -->");
    expect(serialize("<!--")).toBe("<!--<!- - -->");
  });

  it("leaves ordinary marker data unchanged", () => {
    for (const data of ["", "[", "]", "case a", "k:1"]) expect(serialize(data)).toBe(`<!--${data}-->`);
  });

  it("toHtml escapes a top-level comment too", () => {
    expect(toHtml(doc.createComment("--><b>"))).toBe("<!--- -><b>-->");
  });
});

describe("server DOM raw text", () => {
  const withText = (tag: string, data: string): string => {
    const el = doc.createElement(tag);
    el.appendChild(doc.createTextNode(data));
    return el.outerHTML;
  };

  it("script text cannot close the script or open an escaped comment", () => {
    expect(withText("script", 'x="</script><img src=x onerror=alert(1)>"')).toBe(
      '<script>x="<\\/script><img src=x onerror=alert(1)>"</script>',
    );
    expect(withText("script", "a</SCRIPT b")).toBe("<script>a<\\/SCRIPT b</script>");
    expect(withText("script", "'<!--<script>'")).toBe("<script>'<\\!--<script>'</script>");
    expect(withText("script", "a < b && c </div>")).toBe("<script>a < b && c </div></script>");
  });

  it("style text containing </style throws; other style text is raw", () => {
    expect(() => withText("style", "a{}</style><script>alert(1)</script>")).toThrow(/<style> text contains/);
    expect(() => withText("style", "a{}</STYLE")).toThrow(/<style> text contains/);
    expect(withText("style", "a>b{c:'<'}")).toBe("<style>a>b{c:'<'}</style>");
  });
});

describe("backlog 0140: raw text across siblings, comments and foreign content", () => {
  type Kid = readonly ["text" | "comment" | "el", string];
  const build = (path: readonly string[], kids: readonly Kid[]): string => {
    const root = doc.createElement(path[0] ?? "div");
    let at = root;
    for (const tag of path.slice(1)) at = at.appendChild(doc.createElement(tag));
    for (const [kind, v] of kids) {
      at.appendChild(
        kind === "text" ? doc.createTextNode(v) : kind === "comment" ? doc.createComment(v) : doc.createElement(v),
      );
    }
    return root.outerHTML;
  };

  it("(a) adjacent text nodes are escaped together: '<' + '/script>' cannot close the script", () => {
    expect(
      build(
        ["script"],
        [
          ["text", "<"],
          ["text", "/script><img src=x onerror=alert(1)>"],
        ],
      ),
    ).toBe("<script><\\/script><img src=x onerror=alert(1)></script>");
    expect(
      build(
        ["script"],
        [
          ["text", "<!"],
          ["text", "--"],
        ],
      ),
    ).toBe("<script><\\!--</script>");
    expect(() =>
      build(
        ["style"],
        [
          ["text", "</"],
          ["text", "style><img src=x onerror=alert(1)>"],
        ],
      ),
    ).toThrow(/<style> text contains/);
  });

  it("(b) a comment inside a text-only element is dropped and cannot close it", () => {
    const evil = (tag: string): string => `</${tag}><img src=x onerror=alert(1)>`;
    for (const tag of ["script", "style", "textarea", "title", "xmp", "iframe", "noembed", "noframes", "noscript"]) {
      expect(
        build(
          [tag],
          [
            ["text", "a"],
            ["comment", evil(tag)],
            ["text", "b"],
          ],
        ),
        tag,
      ).toBe(`<${tag}>ab</${tag}>`);
    }
    expect(build(["textarea"], [["text", "<b>"]])).toBe("<textarea>&lt;b&gt;</textarea>");
  });

  it("(b) a nested element that would end a text-only element throws", () => {
    expect(() => build(["textarea"], [["el", "textarea"]])).toThrow(/<textarea> content would end the element/);
    expect(() => build(["title"], [["el", "title"]])).toThrow(/<title> content would end the element/);
    expect(build(["script"], [["el", "script"]])).toBe("<script><script><\\/script></script>");
  });

  it("(c) svg/math style and script text is escaped, never raw markup", () => {
    expect(build(["svg", "style"], [["text", "<img src=x onerror=alert(1)>"]])).toBe(
      "<svg><style>&lt;img src=x onerror=alert(1)&gt;</style></svg>",
    );
    expect(build(["svg", "script"], [["text", "</script><img src=x onerror=alert(1)>"]])).toBe(
      "<svg><script>&lt;/script&gt;&lt;img src=x onerror=alert(1)&gt;</script></svg>",
    );
    expect(
      build(
        ["math", "style"],
        [
          ["text", "<"],
          ["text", "/style><img>"],
        ],
      ),
    ).toBe("<math><style>&lt;/style&gt;&lt;img&gt;</style></math>");
    // Through an HTML integration point the element may be read as HTML raw text: the escaped text stays inert.
    expect(build(["svg", "foreignobject", "style"], [["comment", "</style><img src=x onerror=alert(1)>"]])).toBe(
      "<svg><foreignobject><style></style></foreignobject></svg>",
    );
  });

  it("(c) a style under svg inside a template's content is still escaped when serialized from the svg", () => {
    const svg = doc.createElement("svg");
    const t = svg.appendChild(doc.createElement("template"));
    const style = doc.createElement("style");
    style.appendChild(doc.createTextNode("<img src=x onerror=alert(1)>"));
    if (!("content" in t) || !(t.content instanceof ServerFragment)) throw new Error("no template content");
    t.content.appendChild(style);
    expect(svg.outerHTML).toBe("<svg><template><style>&lt;img src=x onerror=alert(1)&gt;</style></template></svg>");
  });
});
