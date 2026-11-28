// @vitest-environment happy-dom
// k.resume, Layout islands "With no server content (no `children` call, or the slot's branch did not render), a call returns nothing."
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
  resumeBody,
  serve,
} from "./resume-app.ts";
import { ZERO } from "./resume-test-app.ts";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("k.resume: a layout that never calls children", () => {
  it("the server places no child content: no page island root and no region in the document", async () => {
    install(await serve(ZERO, "/zero"));
    expect(maybe("zp.root")).toBeNull();
    expect(document.querySelector('[data-k-island="zp.page"]')).toBeNull();
    expect(document.body.innerHTML).not.toContain("<!--[-->");
  });

  it("the layout resumes with no warning, keeping every server node, and its handler runs", async () => {
    install(await serve(ZERO, "/zero"));
    const before = elementsOf(document.body);
    const { warnings, console: logged } = resumeBody(componentsOf(ZERO));
    expect(warnings).toEqual([]);
    expect(logged).toEqual([]);
    expectKept(before);
    await click("zl.inc");
    expectText("zl.out", "1");
  });
});
