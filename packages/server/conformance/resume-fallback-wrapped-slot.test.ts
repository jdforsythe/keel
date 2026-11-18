// @vitest-environment happy-dom
// Spec: k.resume, Conformance "A layout island with its slot in an `If` in a wrapper element, mismatching before calling `children`, re-renders with one wrapper around the page island's server nodes; a click queued on the layout is dropped, one on the page replays."
// Spec: k.resume, Nested islands "The server writes `<!--k-->` first in a child level's content; a layout island mismatching before its `children` call holds only that comment's region."
// Seed: 1337 (no generated inputs). Real compiled TSX, real createApp, real resume; the client layout has an extra element ahead of the `If`.
import { afterEach, describe, expect, it } from "vitest";
import {
  type Component,
  type Level,
  componentsOf,
  elementsOf,
  install,
  islandPage,
  q,
  serve,
  staticLayout,
} from "./resume-app.ts";
import { clickNow, recording, resumeObserved } from "./resume-replay-app.ts";

afterEach(() => {
  document.body.innerHTML = "";
});

/** A layout island whose slot sits in an `If` inside a wrapper element; `pre` is markup ahead of the `If`. */
const wrapped = (k: string, pre = ""): string => `import { signal } from "@keel/reactive";
import { If } from "@keel/runtime-dom";
export default function Layout(props) {
  const n = signal(0);
  const shown = signal(true);
  return <div id="${k}.root">${pre}<button id="${k}.btn" onClick={() => n.set(n.get() + 1)}>b</button><span id="${k}.out">{n.get()}</span><If when={shown.get()}><div class="wrap" id="${k}.wrap">{props.children()}</div></If></div>
}
`;

const EXTRA = "<em>extra</em>";

const ISLAND: readonly Level[] = [
  { id: "wl.layout", source: wrapped("wl") },
  { id: "wp.page", source: islandPage("wp"), path: "/wrapped", layout: "wl.layout", title: "p" },
];

const STATIC_BETWEEN: readonly Level[] = [
  { id: "xl.layout", source: wrapped("xl") },
  { id: "xm.layout", source: staticLayout("xm"), layout: "xl.layout", title: "m" },
  { id: "xp.page", source: islandPage("xp"), path: "/between", layout: "xm.layout", title: "p" },
];

function wires(levels: readonly Level[], override: Readonly<Record<string, string>>, log: string[]) {
  const out: Record<string, Component> = {};
  for (const [id, c] of Object.entries(componentsOf(levels, override))) out[id] = recording(c, log);
  return out;
}

const count = (selector: string): number => document.querySelectorAll(selector).length;

describe("k.resume: a layout island mismatching before its children call holds only the child level's region", () => {
  it("one E1253 warning and exactly one wrapper in the document after the fallback", async () => {
    install(await serve(ISLAND, "/wrapped"));
    expect(count(".wrap")).toBe(1);
    const { warnings } = resumeObserved(wires(ISLAND, { "wl.layout": wrapped("wl", EXTRA) }, []));
    expect(warnings).toHaveLength(1);
    expect(String(warnings[0])).toMatch(/^E1253 \[data-k-island="wl\.layout"\]/);
    expect(count(".wrap")).toBe(1);
    expect(q("wl.root").querySelector("em")?.textContent).toBe("extra");
  });

  it("the page island's root is the server element, inside the one wrapper, and its handler runs", async () => {
    install(await serve(ISLAND, "/wrapped"));
    const page = q("wp.root");
    const pageNodes = elementsOf(page);
    resumeObserved(wires(ISLAND, { "wl.layout": wrapped("wl", EXTRA) }, []));
    expect(q("wp.root")).toBe(page);
    expect(page.parentElement?.getAttribute("class")).toBe("wrap");
    elementsOf(page).forEach((el, i) => expect(el).toBe(pageNodes[i]));
    clickNow("wp.inc");
    await Promise.resolve();
    expect(q("wp.out").textContent).toBe("1");
  });

  it("a click queued on the layout is dropped and one queued on the page replays once", async () => {
    install(await serve(ISLAND, "/wrapped"));
    clickNow("wl.btn");
    clickNow("wp.inc");
    resumeObserved(wires(ISLAND, { "wl.layout": wrapped("wl", EXTRA) }, []));
    expect(q("wl.out").textContent).toBe("0");
    expect(q("wp.out").textContent).toBe("1");
  });

  it("with an island layout around a static layout around an island page: one wrapper of each, the static level's nodes kept", async () => {
    install(await serve(STATIC_BETWEEN, "/between"));
    const middle = q("xm.root");
    const page = q("xp.root");
    const middleNodes = elementsOf(middle);
    const { warnings } = resumeObserved(wires(STATIC_BETWEEN, { "xl.layout": wrapped("xl", EXTRA) }, []));
    expect(warnings).toHaveLength(1);
    expect(count(".wrap")).toBe(1);
    expect(count("section")).toBe(1);
    expect(q("xm.root")).toBe(middle);
    expect(q("xp.root")).toBe(page);
    expect(middle.parentElement?.getAttribute("class")).toBe("wrap");
    elementsOf(middle).forEach((el, i) => expect(el).toBe(middleNodes[i]));
  });

  it("under the static middle level a queued click on the layout is dropped, one on the page replays once", async () => {
    install(await serve(STATIC_BETWEEN, "/between"));
    clickNow("xl.btn");
    clickNow("xp.inc");
    resumeObserved(wires(STATIC_BETWEEN, { "xl.layout": wrapped("xl", EXTRA) }, []));
    expect(q("xl.out").textContent).toBe("0");
    expect(q("xp.out").textContent).toBe("1");
  });
});

describe("k.resume: the server writes <!--k--> first in a child level's content", () => {
  const markers = (root: Node): Comment[] => {
    const out: Comment[] = [];
    const walk = (n: Node): void => {
      for (const c of [...n.childNodes]) {
        if (c instanceof Comment && c.nodeValue === "k") out.push(c);
        walk(c);
      }
    };
    walk(root);
    return out;
  };

  it("one marker in a layout over a page, and it is directly followed by the page's root element", async () => {
    install(await serve(ISLAND, "/wrapped"));
    const found = markers(document.body);
    expect(found).toHaveLength(1);
    expect(found[0]?.nextSibling).toBe(q("wp.root"));
  });

  it("with a static level between, each child level's content begins with a marker followed by that level's root", async () => {
    install(await serve(STATIC_BETWEEN, "/between"));
    const found = markers(document.body);
    expect(found).toHaveLength(2);
    expect(found[0]?.nextSibling).toBe(q("xm.root"));
    expect(found[1]?.nextSibling).toBe(q("xp.root"));
  });

  it("the marker is in the layout's own element, after the layout's own nodes, so it is the first <!--k--> in document order", async () => {
    install(await serve(ISLAND, "/wrapped"));
    const found = markers(q("wl.root"));
    expect(found).toHaveLength(1);
    expect(q("wl.root").contains(found[0] ?? null)).toBe(true);
    expect(q("wl.btn").compareDocumentPosition(found[0] ?? q("wl.btn")) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });

  it("a layout that never calls children writes no marker", async () => {
    const none: readonly Level[] = [
      { id: "nl.layout", source: wrapped("nl").replace("{props.children()}", "") },
      { id: "np.page", source: islandPage("np"), path: "/none", layout: "nl.layout", title: "p" },
    ];
    install(await serve(none, "/none"));
    expect(markers(document.body)).toHaveLength(0);
  });
});
