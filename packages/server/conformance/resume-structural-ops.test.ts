// @vitest-environment happy-dom
// Spec: k.resume, Conformance "An island page with a `Boundary` around a `Match` whose case holds a `For` whose rows hold an `If`: it resumes with no warning; flipping the `If` in one row, adding and removing a row, changing the case and resetting the Boundary each update in place, keeping the other nodes."
// Seed: 1337. Real compiled TSX, real createApp, real resume.
import { afterEach, describe, expect, it } from "vitest";
import { click, componentsOf, elementsOf, expectKept, install, maybe, q, resumeBody, serve } from "./resume-app.ts";
import { STRUCTURAL } from "./resume-test-app.ts";

afterEach(() => {
  document.body.innerHTML = "";
});

const rows = (): Element[] => [...q("sp.list").querySelectorAll("li.row")];
const labels = (): string[] => rows().map((r) => r.querySelector("span")?.textContent ?? "");
const flags = (): boolean[] => rows().map((r) => r.querySelector("b.on") !== null);

async function resumed() {
  install(await serve(STRUCTURAL, "/structural"));
  const before = elementsOf(document.body);
  const { warnings } = resumeBody(componentsOf(STRUCTURAL));
  return { before, warnings };
}

describe("k.resume: an island page with a Boundary around a Match whose case holds a For whose rows hold an If", () => {
  it("it resumes with no warning, keeping every server node", async () => {
    const { before, warnings } = await resumed();
    expect(warnings).toEqual([]);
    expectKept(before);
    expect(labels()).toEqual(["a", "b"]);
    expect(flags()).toEqual([true, false]);
  });

  it("flipping the If in one row updates in place, keeping the other nodes", async () => {
    const { warnings } = await resumed();
    expect(warnings).toEqual([]);
    const [a, b] = rows();
    const aMark = a?.querySelector("b.on");
    await click("sp.flipb");
    expect(flags()).toEqual([true, true]);
    expect(rows()[0]).toBe(a);
    expect(rows()[1]).toBe(b);
    expect(a?.querySelector("b.on")).toBe(aMark);
    await click("sp.flipa");
    expect(flags()).toEqual([false, true]);
    expect(rows()[0]).toBe(a);
    expect(rows()[1]).toBe(b);
  });

  it("adding a row updates in place, keeping the other nodes", async () => {
    const { before, warnings } = await resumed();
    expect(warnings).toEqual([]);
    await click("sp.add");
    expect(labels()).toEqual(["a", "b", "c"]);
    expect(rows().slice(0, 2)).toEqual(before.filter((e) => e.matches("li.row")));
    for (const el of before) expect(el.isConnected).toBe(true);
  });

  it("removing a row updates in place, keeping the other nodes", async () => {
    const { warnings } = await resumed();
    expect(warnings).toEqual([]);
    const [a, b] = rows();
    await click("sp.rm");
    expect(labels()).toEqual(["b"]);
    expect(rows()[0]).toBe(b);
    expect(a?.isConnected).toBe(false);
  });

  it("changing the case updates in place, keeping the nodes outside it", async () => {
    const { warnings } = await resumed();
    expect(warnings).toEqual([]);
    const outside = [q("sp.root"), q("sp.inc"), q("sp.view"), q("sp.inner"), q("sp.boom")];
    await click("sp.view");
    expect(maybe("sp.list")).toBeNull();
    expect(q("sp.note").textContent).toBe("note");
    for (const el of outside) expect(el.isConnected).toBe(true);
    expect(q("sp.root")).toBe(outside[0]);
    expect(q("sp.inner")).toBe(outside[3]);
    await click("sp.view");
    expect(labels()).toEqual(["a", "b"]);
    expect(q("sp.inner")).toBe(outside[3]);
  });

  it("resetting the Boundary updates in place, keeping the nodes outside it", async () => {
    const { warnings } = await resumed();
    expect(warnings).toEqual([]);
    const outside = [q("sp.root"), q("sp.inc"), q("sp.view"), q("sp.add")];
    await click("sp.boom");
    expect(maybe("sp.err")).not.toBeNull();
    expect(maybe("sp.inner")).toBeNull();
    await click("sp.retry");
    expect(maybe("sp.err")).toBeNull();
    expect(labels()).toEqual(["a", "b"]);
    for (const el of outside) expect(el.isConnected).toBe(true);
    expect(q("sp.root")).toBe(outside[0]);
    expect(q("sp.add")).toBe(outside[3]);
  });
});
