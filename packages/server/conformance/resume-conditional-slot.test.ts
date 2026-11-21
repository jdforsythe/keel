// @vitest-environment happy-dom
// Spec: k.resume, Conformance "A layout island rendering `children()` inside an `If`: served with the branch shown, hiding it detaches the page and showing it puts back the same nodes, whose handler still runs with its state kept; served with it hidden, it resumes with no warning and showing it renders nothing."
// Seed: 1337. Real compiled TSX, real createApp, real resume.
import { afterEach, describe, expect, it } from "vitest";
import {
  click,
  componentsOf,
  elementsOf,
  expectKept,
  expectText,
  install,
  maybe,
  q,
  resumeBody,
  serve,
} from "./resume-app.ts";
import { HIDDEN, SHOWN } from "./resume-test-app.ts";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("k.resume: a layout island rendering children() inside an If", () => {
  it("served with the branch shown, it resumes with no warning, keeping every server node", async () => {
    install(await serve(SHOWN, "/shown"));
    expect(maybe("c1p.root")).not.toBeNull();
    const before = elementsOf(document.body);
    expect(resumeBody(componentsOf(SHOWN)).warnings).toEqual([]);
    expectKept(before);
  });

  it("hiding it detaches the page and showing it puts back the same nodes", async () => {
    install(await serve(SHOWN, "/shown"));
    const page = q("c1p.root");
    const pageNodes = elementsOf(page);
    const layout = q("c1.root");
    expect(resumeBody(componentsOf(SHOWN)).warnings).toEqual([]);
    await click("c1.toggle");
    expect(page.isConnected).toBe(false);
    expect(maybe("c1p.root")).toBeNull();
    expect(layout.isConnected).toBe(true);
    await click("c1.toggle");
    expect(q("c1p.root")).toBe(page);
    expect(page.parentNode).toBe(layout);
    expect(elementsOf(page)).toEqual(pageNodes);
    elementsOf(page).forEach((el, i) => expect(el).toBe(pageNodes[i]));
  });

  it("the page's handler still runs after hide and show, with its state kept", async () => {
    install(await serve(SHOWN, "/shown"));
    expect(resumeBody(componentsOf(SHOWN)).warnings).toEqual([]);
    await click("c1p.inc");
    expectText("c1p.out", "1");
    await click("c1.toggle");
    await click("c1.toggle");
    expectText("c1p.out", "1");
    await click("c1p.inc");
    expectText("c1p.out", "2");
  });

  it("served with it hidden, it resumes with no warning", async () => {
    install(await serve(HIDDEN, "/hidden"));
    expect(maybe("c2p.root")).toBeNull();
    const before = elementsOf(document.body);
    const { warnings, console: logged } = resumeBody(componentsOf(HIDDEN));
    expect(warnings).toEqual([]);
    expect(logged).toEqual([]);
    expectKept(before);
  });

  it("served with it hidden, showing it renders nothing", async () => {
    install(await serve(HIDDEN, "/hidden"));
    const before = elementsOf(document.body);
    expect(resumeBody(componentsOf(HIDDEN)).warnings).toEqual([]);
    await click("c2.toggle");
    expect(maybe("c2p.root")).toBeNull();
    expect(elementsOf(document.body)).toEqual(before);
    await click("c2.toggle");
    await click("c2.toggle");
    expect(maybe("c2p.root")).toBeNull();
    expect(elementsOf(document.body)).toEqual(before);
    await click("c2.inc");
    expectText("c2.out", "1");
  });
});
