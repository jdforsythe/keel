// @vitest-environment happy-dom
// alignTexts: a server element gets the empty text nodes its template has, outside server regions.
import { describe, expect, it } from "vitest";
import { alignTexts } from "../src/internal/alignTexts.ts";

const div = (html: string): Element => {
  const d = document.createElement("div");
  d.innerHTML = html;
  return d;
};
const shape = (el: Element): string[] =>
  [...el.childNodes].map((n) =>
    n.nodeType === 3
      ? `t:${n.nodeValue}`
      : n.nodeType === 8
        ? `c:${n.nodeValue}`
        : n instanceof Element
          ? `<${n.localName}>`
          : "?",
  );
const tplOf = (...kids: (string | Node)[]): Element => {
  const d = document.createElement("div");
  for (const k of kids) d.append(typeof k === "string" ? document.createTextNode(k) : k);
  return d;
};
const el = (name: string, ...kids: (string | Node)[]): Element => {
  const e = document.createElement(name);
  for (const k of kids) e.append(typeof k === "string" ? document.createTextNode(k) : k);
  return e;
};

describe("alignTexts", () => {
  it("inserts an empty text where the template has one and the server has none", () => {
    const server = div("<em></em>");
    alignTexts(tplOf("x", el("em")), server);
    expect(shape(server)).toEqual(["t:", "<em>"]);
    const two = div("");
    alignTexts(tplOf("a", "b"), two);
    expect(shape(two)).toEqual(["t:", "t:"]);
  });

  it("leaves a server text node alone and does not insert more", () => {
    const server = div("hi<em></em>");
    alignTexts(tplOf("x", el("em")), server);
    expect(shape(server)).toEqual(["t:hi", "<em>"]);
  });

  it("recurses into matching elements", () => {
    const server = div("<p><b></b></p>");
    alignTexts(tplOf(el("p", "a", el("b", "c"))), server);
    expect(shape(server)).toEqual(["<p>"]);
    const p = server.firstElementChild;
    if (p === null) throw new Error("fixture");
    expect(shape(p)).toEqual(["t:", "<b>"]);
    const b = p.lastElementChild;
    if (b === null) throw new Error("fixture");
    expect(shape(b)).toEqual(["t:"]);
  });

  it("skips a server region, nested regions included, and puts the text after it", () => {
    const server = div("<!--[--><i></i><!--]--><!---->");
    alignTexts(tplOf("x", document.createComment("")), server);
    expect(shape(server)).toEqual(["c:[", "<i>", "c:]", "t:", "c:"]);
    const nested = div("<!--[--><!--[--><i></i><!--]--><u></u><!--]--><!---->");
    alignTexts(tplOf("x", document.createComment("")), nested);
    expect(shape(nested)).toEqual(["c:[", "c:[", "<i>", "c:]", "<u>", "c:]", "t:", "c:"]);
  });

  it("skips several regions in a row and a region at the end", () => {
    const server = div("<!--[--><i></i><!--]--><!--[--><u></u><!--]-->");
    alignTexts(tplOf("x"), server);
    expect(shape(server)).toEqual(["c:[", "<i>", "c:]", "c:[", "<u>", "c:]", "t:"]);
  });

  it("does not skip other comments or text that only looks like a region marker", () => {
    const anchor = div("<!---->");
    alignTexts(tplOf("x", document.createComment("")), anchor);
    expect(shape(anchor)).toEqual(["t:", "c:"]);
    const other = div("<!--]--><!--x-->");
    alignTexts(tplOf("x"), other);
    expect(shape(other)).toEqual(["t:", "c:]", "c:x"]);
    const open = div("");
    open.append(document.createTextNode("["));
    alignTexts(tplOf("x"), open);
    expect(shape(open)).toEqual(["t:["]);
    const close = div("");
    close.append(document.createComment("["), document.createTextNode("]"), document.createElement("i"));
    alignTexts(tplOf("x"), close);
    // The text "]" does not close the region, so the whole tail is skipped and the empty text goes last.
    expect(shape(close)).toEqual(["c:[", "t:]", "<i>", "t:"]);
  });

  it("an inserted text node is empty", () => {
    const server = div("");
    alignTexts(tplOf("x"), server);
    expect(server.firstChild?.nodeValue).toBe("");
  });
});
