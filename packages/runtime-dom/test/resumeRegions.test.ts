// @vitest-environment happy-dom
// k.resume Regions, Nested islands and Layout islands, piece by piece: the anchor after a server region, the shape a
// template and a server element are compared by, the child level salvaged from a failed claim, and a resumed island's
// held `children`.
import { afterEach, describe, expect, it } from "vitest";
import { E1255 } from "../src/internal/E1255.ts";
import type { Held } from "../src/internal/Held.ts";
import { Mismatch } from "../src/internal/Mismatch.ts";
import { cx } from "../src/internal/cx.ts";
import { heldChildren } from "../src/internal/heldChildren.ts";
import { heldOf } from "../src/internal/heldOf.ts";
import { nextAnchor } from "../src/internal/nextAnchor.ts";
import { replaced } from "../src/internal/replaced.ts";
import { salvage } from "../src/internal/salvage.ts";
import { sameShape } from "../src/internal/sameShape.ts";
import { shapeOf } from "../src/internal/shapeOf.ts";

const div = (html: string): HTMLElement => {
  const d = document.createElement("div");
  d.innerHTML = html;
  return d;
};
const first = (html: string): Element => {
  const el = div(html).firstElementChild;
  if (el === null) throw new Error("no element");
  return el;
};
const show = (n: Node | null | undefined): string => {
  if (n === null || n === undefined) return "none";
  if (n.nodeType === 3) return `t:${n.nodeValue}`;
  if (n.nodeType === 8) return `c:${n.nodeValue}`;
  return n instanceof Element ? `<${n.localName}>` : "?";
};
const region = (html: string, pos = 0): { nodes: Node[]; pos: number } => ({ nodes: [...div(html).childNodes], pos });

function mismatch(fn: () => unknown): unknown {
  try {
    fn();
  } catch (e) {
    return e;
  }
  throw new Error("expected a throw");
}

describe("nextAnchor", () => {
  it("skips one server region and returns the anchor after it, the cursor past the anchor", () => {
    const r = region("<!--[--><p>a</p>text<!--x--><!--]--><!--a--><b></b>");
    expect(show(nextAnchor(r))).toBe("c:a");
    expect(r.pos).toBe(6);
  });

  it("skips the regions nested in the region", () => {
    const r = region("<!--[--><!--[--><i></i><!--]--><!--inner--><b></b><!--]--><!--a--><!--b-->");
    expect(show(nextAnchor(r))).toBe("c:a");
    expect(r.pos).toBe(8);
    expect(show(nextAnchor(r))).toBe("c:b");
  });

  it("starts at the cursor, not at the first node", () => {
    const r = region("<!--a--><!--[--><!--]--><!--b-->", 1);
    expect(show(nextAnchor(r))).toBe("c:b");
    expect(r.pos).toBe(4);
  });

  it("an anchor with no region before it is returned, past white space and a missing node", () => {
    const blank = region(" \n\t<!--a-->");
    expect(show(nextAnchor(blank))).toBe("c:a");
    const sparse: Node[] = [];
    sparse[1] = document.createComment("a");
    expect(show(nextAnchor({ nodes: sparse, pos: 0 }))).toBe("c:a");
  });

  it.each([
    ["an element first", "<p></p><!--a-->", 1],
    ["text first", "text<!--a-->", 1],
    ["text that reads as a region's end first", "]<!--a-->", 1],
    ["an element after the region", "<!--[--><!--]--><p></p><!--a-->", 3],
    ["no node", "", 0],
    ["a region and no anchor", "<!--[--><p></p><!--]-->", 3],
    ["a region that never closes", "<!--[--><p></p><!--a-->", 3],
    ["only white space", "  ", 1],
  ])("%s is a mismatch", (_, html, pos) => {
    const r = region(html);
    const e = mismatch(() => nextAnchor(r));
    expect(e).toBeInstanceOf(Mismatch);
    expect(e).toMatchObject({ code: "E1253", message: "no server region and anchor where an op renders" });
    expect(r.pos).toBe(pos);
  });
});

describe("shapeOf", () => {
  const shape = (html: string): (string | null)[] => shapeOf(div(html)).map((e) => (e === null ? null : e.localName));

  it("lists child elements only, a component slot as null", () => {
    expect(shape("text<a></a><!--x--><b><i></i></b><!--+-->tail<u></u>")).toEqual(["a", "b", null, "u"]);
  });

  it("skips a server region whole, nested regions and slots inside it too", () => {
    expect(shape("<a></a><!--[--><x></x><!--[--><y></y><!--]--><!--+--><z></z><!--]--><b></b><!--+-->")).toEqual([
      "a",
      "b",
      null,
    ]);
  });

  it("a closing marker with no region open changes nothing", () => {
    expect(shape("<!--]--><a></a><!--+--><!--[--><x></x><!--]--><b></b>")).toEqual(["a", null, "b"]);
  });
});

describe("sameShape", () => {
  const same = (tpl: string, server: string): string | null => sameShape(first(tpl), first(server));

  it("equal structures match, whatever their text and regions", () => {
    expect(
      same("<ul><li><b></b></li><!--s--></ul>", "<ul>x<li><b>y</b></li><!--[--><p></p><!--]--><!--s--></ul>"),
    ).toBe(null);
  });

  it("names the server tag and the template tag that differ, at any depth", () => {
    expect(same("<div></div>", "<span></span>")).toBe("<span> where the template has <div>");
    expect(same("<ul><li><b></b></li></ul>", "<ul><li><i></i></li></ul>")).toBe("<i> where the template has <b>");
    expect(same("<ul><li></li><b></b></ul>", "<ul><li></li><i></i></ul>")).toBe("<i> where the template has <b>");
  });

  it("counts the child elements when the template has no slot, or the server has fewer", () => {
    expect(same("<div><a></a><b></b></div>", "<div><a></a><b></b><i></i></div>")).toBe(
      "<div> has 3 child elements where the template has 2",
    );
    expect(same("<div><a></a><b></b></div>", "<div><a></a></div>")).toBe(
      "<div> has 1 child elements where the template has 2",
    );
    expect(same("<div><a></a><!--+--><b></b></div>", "<div><a></a><b></b></div>")).toBe(
      "<div> has 2 child elements where the template has 3",
    );
  });

  it("a slot takes the one element the component rendered, whatever its tag", () => {
    expect(same("<div><a></a><!--+--><b></b></div>", "<div><a></a><section></section><b></b></div>")).toBe(null);
  });

  it("the last slot takes the extra elements, and those after it compare from the end", () => {
    const tpl = "<div><a></a><!--+--><b></b></div>";
    expect(same(tpl, "<div><a></a><x></x><y></y><b></b></div>")).toBe(null);
    expect(same(tpl, "<div><a></a><x></x><y></y><i></i></div>")).toBe("<i> where the template has <b>");
    expect(same(tpl, "<div><i></i><x></x><y></y><b></b></div>")).toBe("<i> where the template has <a>");
    expect(same(tpl, "<div><a></a><b></b><y></y><b></b></div>")).toBe(null);
  });

  it("a slot that is the first child takes the extras too", () => {
    expect(same("<div><!--+--><b></b></div>", "<div><x></x><y></y><b></b></div>")).toBe(null);
    expect(same("<div><!--+--><b></b></div>", "<div><b></b><x></x><y></y></div>")).toBe(
      "<y> where the template has <b>",
    );
  });

  it("with two slots only the last takes extras", () => {
    const tpl = "<div><!--+--><a></a><!--+--></div>";
    expect(same(tpl, "<div><x></x><a></a><y></y><z></z></div>")).toBe(null);
    expect(same(tpl, "<div><x></x><y></y><a></a><z></z></div>")).toBe("<y> where the template has <a>");
  });
});

describe("salvage", () => {
  const taken = (html: string): string[] => salvage(div(html)).map(show);

  it("takes the nodes from the first k marker to the end of its region, the closing marker left out", () => {
    expect(taken("<p>before</p><!--k--><b>x</b>text<u></u><!--]--><s>after</s>")).toEqual([
      "c:k",
      "<b>",
      "t:text",
      "<u>",
    ]);
  });

  it("keeps the regions inside the child level whole", () => {
    expect(taken("<!--k--><!--[--><!--[--><i></i><!--]-->x<!--]-->y<!--]-->z")).toEqual([
      "c:k",
      "c:[",
      "c:[",
      "<i>",
      "c:]",
      "t:x",
      "c:]",
      "t:y",
    ]);
  });

  it("finds a marker below other elements and stops at the end of its parent", () => {
    expect(taken("<header><p></p></header><main><span><!--k--><b></b>tail</span><em></em></main>")).toEqual([
      "c:k",
      "<b>",
      "t:tail",
    ]);
  });

  it("the first marker in document order wins", () => {
    expect(taken("<a><!--k-->inner</a><!--k-->outer")).toEqual(["c:k", "t:inner"]);
    expect(taken("<!--k-->outer<a><!--k-->inner</a>")).toEqual(["c:k", "t:outer", "<a>"]);
  });

  it("without a k comment there is nothing", () => {
    expect(taken("")).toEqual([]);
    expect(taken("<p>k</p>k<!--kk--><!--[--><b></b><!--]-->")).toEqual([]);
  });
});

describe("heldChildren", () => {
  const before = cx.claim;
  afterEach(() => {
    cx.claim = before;
    document.body.replaceChildren();
  });
  const session = { failed: null, shadowed: [] };

  it("while the island claims, takes the rest of the region as held and leaves it in place", () => {
    const parent = div("<a></a><b></b>text<i></i>");
    const nodes = [...parent.childNodes];
    const claimed = { nodes, pos: 1 };
    cx.claim = { island: null, region: claimed, session };
    const held: Held = { nodes: null, calls: 0 };
    const f = heldChildren(held)();
    expect(f.nodeType).toBe(11);
    expect(f.childNodes).toHaveLength(0);
    expect(heldOf.get(f)).toBe(held);
    expect(held.nodes?.map(show)).toEqual(["<b>", "t:text", "<i>"]);
    expect(claimed.pos).toBe(4);
    expect([...parent.childNodes]).toEqual(nodes);
    expect(held.calls).toBe(1);
  });

  it("a second call while the island builds throws E1255", () => {
    cx.claim = { island: null, region: { nodes: [], pos: 0 }, session };
    const children = heldChildren({ nodes: null, calls: 0 });
    children();
    expect(() => children()).toThrow(E1255);
  });

  it("after the build, each call moves the held nodes into the fragment it returns", () => {
    const parent = div("<a></a>text<b></b>");
    const held: Held = { nodes: [...parent.childNodes], calls: -1 };
    parent.replaceChildren();
    const children = heldChildren(held);
    const one = children();
    expect([...one.childNodes].map(show)).toEqual(["<a>", "t:text", "<b>"]);
    expect(heldOf.get(one)).toBe(held);
    const two = children();
    expect([...two.childNodes].map(show)).toEqual(["<a>", "t:text", "<b>"]);
    expect(one.childNodes).toHaveLength(0);
    expect(heldOf.get(two)).toBe(held);
    expect(held.calls).toBe(-1);
  });

  it("held content already taken is moved, not taken again, while another region is being claimed", () => {
    const a = document.createElement("a");
    const other = { nodes: [document.createElement("p")], pos: 0 };
    cx.claim = { island: null, region: other, session };
    const held: Held = { nodes: [a], calls: -1 };
    const f = heldChildren(held)();
    expect([...f.childNodes]).toEqual([a]);
    expect(held.nodes).toEqual([a]);
    expect(other.pos).toBe(0);
  });

  it("with no region to claim and nothing held the fragment is empty", () => {
    cx.claim = { island: null, region: null, session };
    const held: Held = { nodes: null, calls: -1 };
    expect(heldChildren(held)().childNodes).toHaveLength(0);
    expect(held.nodes).toBeNull();
    cx.claim = null;
    expect(heldChildren(held)().childNodes).toHaveLength(0);
    expect(held.nodes).toBeNull();
  });

  it("a call while the held content is in the document throws E1255 and moves nothing", () => {
    const a = document.createElement("a");
    const b = document.createElement("b");
    document.body.append(b);
    cx.claim = null;
    expect(() => heldChildren({ nodes: [a, b], calls: -1 })()).toThrow(E1255);
    expect(b.parentNode).toBe(document.body);
    expect(a.parentNode).toBeNull();
  });

  it("a held island root that re-rendered stands for the nodes in its place", () => {
    const [root, kept, next, deep] = ["section", "a", "b", "i"].map((tag) => document.createElement(tag));
    if (root === undefined || kept === undefined || next === undefined || deep === undefined) throw new Error("tags");
    replaced.set(root, [next, document.createTextNode("t")]);
    replaced.set(next, [deep]);
    cx.claim = null;
    const f = heldChildren({ nodes: [kept, root], calls: -1 })();
    expect([...f.childNodes].map(show)).toEqual(["<a>", "<i>", "t:t"]);
    document.body.append(deep);
    expect(() => heldChildren({ nodes: [kept, root], calls: -1 })()).toThrow(E1255);
  });
});
