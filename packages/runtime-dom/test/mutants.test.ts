// @vitest-environment happy-dom
// Targeted examples pinning hydration-region walking, island props decoding, text binding and list placement.
import { s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { Mismatch } from "../src/internal/Mismatch.ts";
import { islandProps } from "../src/internal/islandProps.ts";
import { nextClaimable } from "../src/internal/nextClaimable.ts";
import { regionOf } from "../src/internal/regionOf.ts";

const html = (s: string): HTMLElement => {
  const host = document.createElement("div");
  host.innerHTML = s;
  return host;
};
/** Host whose last child is a marker comment `<!--@-->` standing for the structural anchor. */
const withAnchor = (s: string): { host: HTMLElement; anchor: Node } => {
  const host = html(`${s}<!--@-->`);
  const anchor = host.lastChild;
  if (anchor === null) throw new Error("no anchor");
  return { host, anchor };
};

describe("regionOf", () => {
  it("returns the nodes between the markers in document order, with end as the closing marker", () => {
    const { host, anchor } = withAnchor("<i>x</i><!--[--><b>1</b>t<u>2</u><!--]-->");
    const r = regionOf(anchor);
    expect(r.nodes.map((n) => n.nodeName)).toEqual(["B", "#text", "U"]);
    expect(r.end).toBe(anchor.previousSibling);
    expect(r.end.nodeValue).toBe("]");
    expect(host.firstChild).not.toBe(r.nodes[0]);
  });

  it("an empty region yields no nodes", () => {
    const { anchor } = withAnchor("<!--[--><!--]-->");
    expect(regionOf(anchor).nodes).toEqual([]);
  });

  it("nested regions are kept whole and the outer start marker is the one matched", () => {
    const { anchor } = withAnchor("<!--[--><a></a><!--[--><b></b><!--]--><c></c><!--]-->");
    const r = regionOf(anchor);
    expect(r.nodes.map((n) => (n.nodeType === 8 ? `c:${n.nodeValue}` : n.nodeName))).toEqual([
      "A",
      "c:[",
      "B",
      "c:]",
      "C",
    ]);
  });

  it("an earlier sibling region does not leak into the nearest one", () => {
    const { anchor } = withAnchor("<!--[--><a></a><!--]--><!--[--><b></b><!--]-->");
    expect(regionOf(anchor).nodes.map((n) => n.nodeName)).toEqual(["B"]);
  });

  it("other comments inside the region are plain nodes", () => {
    const { anchor } = withAnchor("<!--[--><!--x--><a></a><!--]-->");
    expect(regionOf(anchor).nodes.map((n) => n.nodeValue ?? n.nodeName)).toEqual(["x", "A"]);
  });

  it("throws Mismatch when no closing marker precedes the anchor", () => {
    for (const s of ["", "<a></a>", "text", "<!--x-->", "<!--[-->"]) {
      const { anchor } = withAnchor(s);
      expect(() => regionOf(anchor)).toThrow(Mismatch);
      expect(() => regionOf(anchor)).toThrow("no server region <!--[-->...<!--]--> before a structural anchor");
    }
  });

  it("throws Mismatch when the region is unterminated, including nested-unbalanced", () => {
    for (const s of ["<a></a><!--]-->", "<!--[--><!--]--><!--]-->", "<!--[--><!--[--><!--]--><!--]--><!--]-->"]) {
      const { anchor } = withAnchor(s);
      expect(() => regionOf(anchor)).toThrow(Mismatch);
      expect(() => regionOf(anchor)).toThrow("unterminated server region before a structural anchor");
    }
  });

  it("a null previous sibling of a detached anchor is a Mismatch", () => {
    expect(() => regionOf(document.createComment("@"))).toThrow(Mismatch);
  });
});

describe("nextClaimable", () => {
  const region = (s: string): { nodes: Node[]; pos: number } => ({ nodes: [...html(s).childNodes], pos: 0 });

  it("returns elements in order, then null, advancing pos", () => {
    const r = region("<a></a><b></b>");
    expect(nextClaimable(r)).toBe(r.nodes[0]);
    expect(r.pos).toBe(1);
    expect(nextClaimable(r)).toBe(r.nodes[1]);
    expect(nextClaimable(r)).toBeNull();
    expect(r.pos).toBe(2);
    expect(nextClaimable(r)).toBeNull();
  });

  it("an empty region is null", () => {
    expect(nextClaimable({ nodes: [], pos: 0 })).toBeNull();
  });

  it("skips whitespace-only text and comments", () => {
    const r = region("  \n<!--c--> \t<a></a><!--d-->");
    expect(nextClaimable(r)).toBe(r.nodes[3]);
    expect(nextClaimable(r)).toBeNull();
  });

  it("non-whitespace text is a mismatch marker, even padded with whitespace", () => {
    expect(nextClaimable(region("hello"))).toBe("text");
    expect(nextClaimable(region(" x "))).toBe("text");
    const r = region("<a></a>t<b></b>");
    expect(nextClaimable(r)).toBe(r.nodes[0]);
    expect(nextClaimable(r)).toBe("text");
    expect(nextClaimable(r)).toBe(r.nodes[2]);
  });

  it("does not treat a non-text, non-element node with a value as text", () => {
    const r = region("<!--not text-->");
    expect(nextClaimable(r)).toBeNull();
  });

  it("skips a hole in the node list without treating it as text or element", () => {
    const r: { nodes: Node[]; pos: number } = { nodes: [], pos: 0 };
    r.nodes.length = 2;
    expect(nextClaimable(r)).toBeNull();
    expect(r.pos).toBe(2);
  });
});

describe("islandProps", () => {
  const withProps = (Props: unknown): unknown => Object.assign(() => null, { Props });

  it("without a Props schema returns a plain-object json as is, else {}", () => {
    const w: string[] = [];
    const j = { a: 1 };
    expect(islandProps(() => null, j, "i", w)).toBe(j);
    expect(islandProps(() => null, [1], "i", w)).toEqual({});
    expect(islandProps(() => null, null, "i", w)).toEqual({});
    expect(islandProps(() => null, "s", "i", w)).toEqual({});
    expect(w).toEqual([]);
  });

  it("a non-function component or malformed Props is treated as having no schema", () => {
    const w: string[] = [];
    const j = { a: 1 };
    const bad: unknown[] = [
      { Props: { parse: () => ({ ok: true, value: { z: 1 } }) } },
      Object.assign(() => null, { Props: null }),
      Object.assign(() => null, { Props: "x" }),
      Object.assign(() => null, { Props: {} }),
      Object.assign(() => null, { Props: { parse: 1 } }),
      () => null,
      null,
      undefined,
    ];
    for (const c of bad) expect(islandProps(c, j, "i", w)).toBe(j);
    expect(w).toEqual([]);
  });

  it("an object of a schema's shape, or a copy of a schema, is no Props schema (k.identity)", () => {
    const w: string[] = [];
    const j = { a: 1 };
    const S = s.object({ a: s.string() });
    for (const Props of [{ parse: () => ({ ok: true, value: { z: 1 } }) }, { ...S }, new Proxy(S, {})])
      expect(islandProps(withProps(Props), j, "i", w)).toBe(j);
    expect(w).toEqual([]);
  });

  it("uses the parsed record when the schema accepts", () => {
    const w: string[] = [];
    const c = withProps(s.object({ pw: s.secret(s.string()) }));
    const out = islandProps(c, { pw: "x" }, "i", w);
    expect(out.pw).toBeInstanceOf(Object);
    expect(out.pw).not.toBe("x");
    expect(w).toEqual([]);
  });

  it("feeds {} to parse when json is null or undefined, but keeps other falsy json", () => {
    const c = withProps(s.object({ a: s.number().optional() }));
    for (const j of [null, undefined]) {
      const w: string[] = [];
      expect(islandProps(c, j, "i", w)).toEqual({});
      expect(w).toEqual([]);
    }
    for (const j of [0, ""]) {
      const w: string[] = [];
      expect(islandProps(c, j, "i", w)).toEqual({});
      expect(w).toHaveLength(1);
    }
  });

  it("warns E1253 with the island id and falls back when parse fails", () => {
    const w: string[] = [];
    const c = withProps(s.object({ a: s.string() }));
    const j = { a: 1 };
    expect(islandProps(c, j, "main", w)).toBe(j);
    expect(w).toEqual(['E1253 [data-k-island="main"] props do not decode with its Props schema']);
    expect(islandProps(c, [1], "x", w)).toEqual({});
    expect(w).toHaveLength(2);
  });

  it("warns and falls back when parse succeeds with a non-record value", () => {
    const cases: Array<[unknown, unknown]> = [
      [s.number(), 1],
      [s.string(), "s"],
      [s.number().nullable(), null],
      [s.array(s.number()), [1]],
    ];
    for (const [Props, value] of cases) {
      const w: string[] = [];
      expect(islandProps(withProps(Props), value, "k", w)).toEqual({});
      expect(w).toEqual(['E1253 [data-k-island="k"] props do not decode with its Props schema']);
    }
  });
});
