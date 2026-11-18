// @vitest-environment happy-dom
// Spec: k.resume, Regions "every structural op (`If`, `For`, `Match`, `Boundary`) writes its content in a region `<!--[-->` … `<!--]-->` right before its anchor (k.runtime Resume markup), an empty region when it renders nothing; so does every template slot other than a component slot `<!--+-->`: a slot call such as `children()`, or a JSX expression of elements. A `For` region holds its rows in order, or its `empty` content. The root Boundary of a level's render writes no region."
// Seed: 1337. Real compiled TSX, real createApp; the markers are read from the served document.
import { afterEach, describe, expect, it } from "vitest";
import { everyRegionClosesBeforeAnAnchor, install, q, regionTree, serve } from "./resume-app.ts";
import { EMPTY, STRUCTURAL, THREE, TWO, ZERO } from "./resume-test-app.ts";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("k.resume: the regions a served document carries", () => {
  it("Boundary, Match, For and If each write a region, nested in the order the ops nest", async () => {
    install(await serve(STRUCTURAL, "/structural"));
    // Boundary > Match > For > one If per row
    expect(regionTree(q("sp.root"))).toEqual([[[[[], []]]]]);
  });

  it("each region closes right before its anchor", async () => {
    for (const [levels, path] of [
      [STRUCTURAL, "/structural"],
      [EMPTY, "/empty"],
      [TWO, "/two"],
      [THREE, "/three"],
    ] as const) {
      install(await serve(levels, path));
      expect(document.body.innerHTML).toContain("<!--[-->");
      expect(everyRegionClosesBeforeAnAnchor(document.body)).toBe(true);
    }
  });

  it("an If that renders nothing writes an empty region", async () => {
    install(await serve(STRUCTURAL, "/structural"));
    const second = q("sp.list").querySelectorAll("li.row")[1];
    const kinds = [...(second?.childNodes ?? [])].map((n) => (n.nodeType === 8 ? `c:${n.nodeValue}` : n.nodeName));
    expect(kinds.filter((k) => k.startsWith("c:["))).toHaveLength(1);
    const open = [...(second?.childNodes ?? [])].findIndex((n) => n.nodeType === 8 && n.nodeValue === "[");
    expect(second?.childNodes[open + 1]?.nodeType).toBe(8);
    expect(second?.childNodes[open + 1]?.nodeValue).toBe("]");
  });

  it("a For region holds its rows in list order", async () => {
    install(await serve(STRUCTURAL, "/structural"));
    const list = q("sp.list");
    const labels = [...list.querySelectorAll("li.row > span")].map((e) => e.textContent);
    expect(labels).toEqual(["a", "b"]);
    const open = [...list.childNodes].findIndex((n) => n.nodeType === 8 && n.nodeValue === "[");
    const close = [...list.childNodes].findIndex((n) => n.nodeType === 8 && n.nodeValue === "]");
    const between = [...list.childNodes].slice(open + 1, close).filter((n) => n.nodeType === 1);
    expect(between).toHaveLength(2);
  });

  it("a For region holds its empty content while it has no rows", async () => {
    install(await serve(EMPTY, "/empty"));
    const list = q("ep.list");
    expect(regionTree(list)).toEqual([[]]);
    expect(q("ep.none").previousSibling?.nodeValue).toBe("[");
    expect(q("ep.none").nextSibling?.nodeValue).toBe("]");
  });

  it("a slot call such as children() writes a region holding the child level", async () => {
    install(await serve(TWO, "/two"));
    expect(regionTree(q("al.root"))).toEqual([[]]);
    const page = q("ap.root");
    expect(page.previousSibling?.nodeType).toBe(8);
    expect(page.previousSibling?.nodeValue).toBe("k");
    expect(page.previousSibling?.previousSibling?.nodeValue).toBe("[");
    expect(page.nextSibling?.nodeValue).toBe("]");
    expect(page.nextSibling?.nextSibling?.nodeType).toBe(8);
  });

  it("the slot regions of a layout around a static layout around a page nest", async () => {
    install(await serve(THREE, "/three"));
    expect(regionTree(q("bl.root"))).toEqual([[[]]]);
  });

  it("the root Boundary of a level's render writes no region", async () => {
    install(await serve(TWO, "/two"));
    expect(regionTree(q("ap.root"))).toEqual([]);
    expect(q("ap.root").querySelectorAll("*").length).toBeGreaterThan(0);
  });

  it("a layout that does not call children writes no region", async () => {
    install(await serve(ZERO, "/zero"));
    expect(regionTree(q("zl.root"))).toEqual([]);
  });
});
