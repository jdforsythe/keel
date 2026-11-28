// @vitest-environment happy-dom
// Spec: k.resume, clause "A `For` with no rows and an `empty` branch is served as a region holding that content; it resumes keeping it; a first row replaces it."
// Seed: 1337. Real compiled TSX, real createApp, real resume.
import { afterEach, describe, expect, it } from "vitest";
import {
  click,
  componentsOf,
  elementsOf,
  expectKept,
  install,
  maybe,
  q,
  regionTree,
  resumeBody,
  serve,
} from "./resume-app.ts";
import { EMPTY } from "./resume-test-app.ts";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("k.resume: a For with no rows and an empty branch", () => {
  it("is served as a region holding that content", async () => {
    install(await serve(EMPTY, "/empty"));
    const list = q("ep.list");
    const none = q("ep.none");
    expect(none.parentNode).toBe(list);
    expect(none.previousSibling?.nodeValue).toBe("[");
    expect(none.nextSibling?.nodeValue).toBe("]");
    expect(regionTree(list)).toEqual([[]]);
    expect(list.querySelectorAll("li.row")).toHaveLength(0);
  });

  it("resumes keeping it", async () => {
    install(await serve(EMPTY, "/empty"));
    const before = elementsOf(document.body);
    const { warnings } = resumeBody(componentsOf(EMPTY));
    expect(warnings).toEqual([]);
    expectKept(before);
    expect(q("ep.none").textContent).toBe("none");
  });

  it("a first row replaces it", async () => {
    install(await serve(EMPTY, "/empty"));
    const none = q("ep.none");
    expect(resumeBody(componentsOf(EMPTY)).warnings).toEqual([]);
    await click("ep.add");
    expect(maybe("ep.none")).toBeNull();
    expect(none.isConnected).toBe(false);
    expect([...q("ep.list").querySelectorAll("li.row")].map((r) => r.textContent)).toEqual(["r0"]);
    await click("ep.add");
    expect([...q("ep.list").querySelectorAll("li.row")].map((r) => r.textContent)).toEqual(["r0", "r1"]);
  });
});
