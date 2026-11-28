// @vitest-environment happy-dom
// Spec: k.resume, clause "An island layout around an island page: both resume, each with its own props; the page's root is the server element in the layout's slot region; a handler in each runs once per event."
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
import { TWO } from "./resume-test-app.ts";

afterEach(() => {
  document.body.innerHTML = "";
});

async function served() {
  install(await serve(TWO, "/two"));
  const before = elementsOf(document.body);
  const { warnings } = resumeBody(componentsOf(TWO));
  return { before, warnings };
}

describe("k.resume: an island layout around an island page", () => {
  it("both resume with no warning, keeping every server node", async () => {
    const { before, warnings } = await served();
    expect(warnings).toEqual([]);
    expectKept(before);
  });

  it("the served document has two island roots, the layout's and the page's, by route id", async () => {
    install(await serve(TWO, "/two"));
    const ids = [...document.querySelectorAll("[data-k-island]")].map((e) => e.getAttribute("data-k-island"));
    expect(ids).toEqual(["al.layout", "ap.page"]);
  });

  it("each island resumes with its own props: the layout shows its title and the page its own", async () => {
    await served();
    expect(q("al.root").querySelector("h1")?.textContent).toBe("layout-title");
    expect(q("ap.root").querySelector("h3")?.textContent).toBe("page-title");
  });

  it("the page's root is the server element in the layout's slot region", async () => {
    install(await serve(TWO, "/two"));
    const page = q("ap.root");
    const layout = q("al.root");
    expect(page.parentNode).toBe(layout);
    expect(page.previousSibling?.nodeType).toBe(8);
    expect(page.previousSibling?.nodeValue).toBe("k");
    expect(page.previousSibling?.previousSibling?.nodeType).toBe(8);
    expect(page.previousSibling?.previousSibling?.nodeValue).toBe("[");
    expect(page.nextSibling?.nodeType).toBe(8);
    expect(page.nextSibling?.nodeValue).toBe("]");
    const { warnings } = resumeBody(componentsOf(TWO));
    expect(warnings).toEqual([]);
    expect(q("ap.root")).toBe(page);
    expect(page.parentNode).toBe(layout);
  });

  it("a handler in each runs once per event", async () => {
    const { warnings } = await served();
    expect(warnings).toEqual([]);
    await click("al.inc");
    expectText("al.out", "1");
    expectText("ap.out", "0");
    await click("ap.inc");
    expectText("ap.out", "1");
    expectText("al.out", "1");
    await click("al.inc");
    await click("al.inc");
    expectText("al.out", "3");
    expectText("ap.out", "1");
  });
});
