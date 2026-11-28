// @vitest-environment happy-dom
// Spec: k.resume, clause "An island layout around a static layout around an island page: the static level's nodes are kept, unclaimed; the page resumes; handlers in the layout and the page run."
// Seed: 1337. Real compiled TSX, real createApp, real resume.
import { afterEach, describe, expect, it } from "vitest";
import {
  click,
  componentsOf,
  elementsOf,
  expectKept,
  expectText,
  install,
  q,
  resumeBody,
  serve,
} from "./resume-app.ts";
import { THREE } from "./resume-test-app.ts";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("k.resume: an island layout around a static layout around an island page", () => {
  it("the static level's nodes are kept, unclaimed, and carry no island or handler marker", async () => {
    install(await serve(THREE, "/three"));
    const mid = q("bm.root");
    const midNodes = [mid, ...elementsOf(mid).filter((e) => e.getAttribute("data-k-island") === null)];
    const heading = mid.querySelector("h2");
    expect(mid.hasAttribute("data-k-island")).toBe(false);
    expect(mid.hasAttribute("data-k")).toBe(false);
    expect(heading?.textContent).toBe("middle-title");
    const { warnings } = resumeBody(componentsOf(THREE));
    expect(warnings).toEqual([]);
    expect(q("bm.root")).toBe(mid);
    expect(mid.querySelector("h2")).toBe(heading);
    for (const n of midNodes) expect(n.isConnected).toBe(true);
    expect(mid.hasAttribute("data-k")).toBe(false);
  });

  it("only the layout and the page are island roots", async () => {
    install(await serve(THREE, "/three"));
    const ids = [...document.querySelectorAll("[data-k-island]")].map((e) => e.getAttribute("data-k-island"));
    expect(ids).toEqual(["bl.layout", "bp.page"]);
  });

  it("the page resumes: no warning, every server node kept, its own props shown", async () => {
    install(await serve(THREE, "/three"));
    const before = elementsOf(document.body);
    const { warnings } = resumeBody(componentsOf(THREE));
    expect(warnings).toEqual([]);
    expectKept(before);
    expect(q("bp.root").querySelector("h3")?.textContent).toBe("page-title");
    expect(q("bl.root").querySelector("h1")?.textContent).toBe("outer-title");
  });

  it("handlers in the layout and the page run", async () => {
    install(await serve(THREE, "/three"));
    expect(resumeBody(componentsOf(THREE)).warnings).toEqual([]);
    await click("bl.inc");
    expectText("bl.out", "1");
    expectText("bp.out", "0");
    await click("bp.inc");
    await click("bp.inc");
    expectText("bp.out", "2");
    expectText("bl.out", "1");
  });
});
