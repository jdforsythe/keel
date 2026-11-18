// @vitest-environment happy-dom
// Spec: k.resume, Conformance "A layout that calls `children` twice in its body: a request fails its level as a throw whose message starts with `E1255`. After resume, a layout island whose added `For` row calls `children` while another row holds the content throws E1255 to its root Boundary."
// Spec: k.resume, Rules "E1255 a layout called `children` twice while it builds, or while its content is in the document."
// Seed: 1337. Real compiled TSX, real createApp, real resume.
import { afterEach, describe, expect, it } from "vitest";
import {
  type Level,
  click,
  componentsOf,
  elementsOf,
  expectKept,
  install,
  islandLayout,
  islandPage,
  resumeBody,
  serve,
  staticLayout,
} from "./resume-app.ts";

afterEach(() => {
  document.body.innerHTML = "";
});

const ONCE: readonly Level[] = [
  { id: "o1.layout", source: islandLayout("o1"), title: "l" },
  { id: "o1p.page", source: islandPage("o1p"), path: "/once", layout: "o1.layout", title: "p" },
];

const TWICE: readonly Level[] = [
  { id: "o2.layout", source: islandLayout("o2", "{props.children()}{props.children()}"), title: "l" },
  { id: "o2p.page", source: islandPage("o2p"), path: "/twice", layout: "o2.layout", title: "p" },
];

const STATIC_TWICE: readonly Level[] = [
  {
    id: "o3.layout",
    source: staticLayout("o3").replace("{props.children()}", "{props.children()}{props.children()}"),
    title: "l",
  },
  { id: "o3p.page", source: islandPage("o3p"), path: "/static-twice", layout: "o3.layout", title: "p" },
];

const ADDED_ROW = `import { signal } from "@keel/reactive";
import { For } from "@keel/runtime-dom";
export default function Layout(props) {
  const rows = signal([{ id: "a" }]);
  return <div id="o4.root"><button id="o4.add" onClick={() => rows.set([...rows.get(), { id: "b" }])}>add</button><For each={rows.get()} key="id">{(r) => <div class="row">{props.children()}</div>}</For></div>
}
`;

const ROWS: readonly Level[] = [
  { id: "o4.layout", source: ADDED_ROW, title: "l" },
  { id: "o4p.page", source: islandPage("o4p"), path: "/rows", layout: "o4.layout", title: "p" },
];

describe("k.resume: E1255 a layout called children twice while it builds, or while its content is in the document", () => {
  it("a layout that calls children once is served", async () => {
    const doc = await serve(ONCE, "/once", { mode: "dev" });
    expect(doc.status).toBe(200);
    expect(doc.text).not.toContain("E1255");
  });

  it("a layout that calls children twice in its body: a request fails its level as a throw whose message starts with E1255", async () => {
    const doc = await serve(TWICE, "/twice", { mode: "dev" });
    expect(doc.status).toBe(500);
    expect(doc.text).toMatch(/E1255/);
    expect(doc.text).not.toContain('data-k-island="o2p.page"');
  });

  it("a static layout that calls children twice fails its level the same way", async () => {
    const doc = await serve(STATIC_TWICE, "/static-twice", { mode: "dev" });
    expect(doc.status).toBe(500);
    expect(doc.text).toMatch(/E1255/);
  });

  it("the failed request is logged as one E1255 diagnostic", async () => {
    const lines: string[] = [];
    const log = { lines };
    await serve(TWICE, "/twice", { mode: "dev", log });
    expect(log.lines.filter((l) => l.includes("E1255"))).not.toHaveLength(0);
  });

  it("after resume, a layout island whose added For row calls children while another row holds the content throws E1255 to its root Boundary", async () => {
    install(await serve(ROWS, "/rows", { mode: "dev" }));
    const before = elementsOf(document.body);
    const { warnings } = resumeBody(componentsOf(ROWS), "dev");
    expect(warnings).toEqual([]);
    expectKept(before);
    expect(document.querySelector("[data-k-error]")).toBeNull();
    await click("o4.add");
    const fallback = document.querySelector("[data-k-error]");
    expect(fallback).not.toBeNull();
    expect(fallback?.textContent).toContain("E1255");
  });
});
