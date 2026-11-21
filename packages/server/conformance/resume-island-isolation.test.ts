// @vitest-environment happy-dom
// Spec: k.resume, Conformance "A served layout island whose template mismatches (E1253) re-renders while the island page in its slot keeps its server nodes and its handler runs; a page island that mismatches re-renders while the layout keeps its nodes and its slot holds the re-rendered page."
// Seed: 1337. Real compiled TSX, real createApp, real resume; the client component differs from the one the server rendered.
import { afterEach, describe, expect, it } from "vitest";
import {
  click,
  componentsOf,
  elementsOf,
  expectText,
  install,
  islandLayout,
  islandPage,
  q,
  resumeBody,
  serve,
} from "./resume-app.ts";
import { TWO } from "./resume-test-app.ts";

afterEach(() => {
  document.body.innerHTML = "";
});

const LAYOUT_CLIENT = islandLayout("al", "<em>extra</em>{props.children()}");
const PAGE_CLIENT = islandPage("ap", "<em>extra</em>");

describe("k.resume: an island that mismatches re-renders alone", () => {
  it("a served layout island whose template mismatches re-renders in place of its server element", async () => {
    install(await serve(TWO, "/two"));
    const layout = q("al.root");
    const { warnings } = resumeBody(componentsOf(TWO, { "al.layout": LAYOUT_CLIENT }));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/^E1253 \[data-k-island="al\.layout"\]/);
    expect(q("al.root")).not.toBe(layout);
    expect(layout.isConnected).toBe(false);
    expect(q("al.root").querySelector("em")?.textContent).toBe("extra");
  });

  it("the island page in the re-rendered layout's slot keeps its server nodes", async () => {
    install(await serve(TWO, "/two"));
    const page = q("ap.root");
    const pageNodes = elementsOf(page);
    const { warnings } = resumeBody(componentsOf(TWO, { "al.layout": LAYOUT_CLIENT }));
    expect(warnings).toHaveLength(1);
    expect(q("ap.root")).toBe(page);
    expect(page.parentNode).toBe(q("al.root"));
    const after = elementsOf(page);
    expect(after).toHaveLength(pageNodes.length);
    after.forEach((el, i) => expect(el).toBe(pageNodes[i]));
  });

  it("the page's handler runs, and the re-rendered layout's handler runs", async () => {
    install(await serve(TWO, "/two"));
    resumeBody(componentsOf(TWO, { "al.layout": LAYOUT_CLIENT }));
    await click("ap.inc");
    expectText("ap.out", "1");
    await click("al.inc");
    expectText("al.out", "1");
    expectText("ap.out", "1");
  });

  it("a page island that mismatches re-renders in place of its server element, with a warning for it alone", async () => {
    install(await serve(TWO, "/two"));
    const page = q("ap.root");
    const { warnings } = resumeBody(componentsOf(TWO, { "ap.page": PAGE_CLIENT }));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/^E1253 \[data-k-island="ap\.page"\]/);
    expect(q("ap.root")).not.toBe(page);
    expect(page.isConnected).toBe(false);
    expect(q("ap.root").querySelector("em")?.textContent).toBe("extra");
  });

  it("the layout keeps its nodes and its slot holds the re-rendered page", async () => {
    install(await serve(TWO, "/two"));
    const layout = q("al.root");
    const layoutNodes = elementsOf(layout).filter((e) => !q("ap.root").contains(e));
    resumeBody(componentsOf(TWO, { "ap.page": PAGE_CLIENT }));
    expect(q("al.root")).toBe(layout);
    for (const el of layoutNodes) expect(el.isConnected).toBe(true);
    expect(q("ap.root").parentNode).toBe(layout);
    expect(layout.querySelector("h1")).toBe(layoutNodes.find((e) => e.nodeName === "H1"));
    await click("al.inc");
    expectText("al.out", "1");
    await click("ap.inc");
    expectText("ap.out", "1");
  });

  it("both mismatching: each re-renders, each warns once, and the page stays in the layout's slot", async () => {
    install(await serve(TWO, "/two"));
    const { warnings } = resumeBody(componentsOf(TWO, { "al.layout": LAYOUT_CLIENT, "ap.page": PAGE_CLIENT }));
    expect(warnings).toHaveLength(2);
    expect(q("ap.root").parentNode).toBe(q("al.root"));
    await click("al.inc");
    await click("ap.inc");
    expectText("al.out", "1");
    expectText("ap.out", "1");
  });
});
