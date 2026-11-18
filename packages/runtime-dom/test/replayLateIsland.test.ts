// @vitest-environment happy-dom
// k.resume Replay: events queued before resume replay once their islands resume. `resume` called for one root and
// later for another replays each root's events after its own call; an event in an island not resumed yet waits.
import { afterEach, describe, expect, it } from "vitest";
import { eventQueue } from "../src/internal/eventQueue.ts";
import { clone, on, resume, template } from "../src/ops/index.ts";

const island = (id: string, clicks: string[]) => {
  const T = template(`<div data-k-island="${id}"><button data-k="${id}.b">x</button></div>`);
  return (): Node => {
    const root = clone(T);
    on(`${id}.b`, "click", () => void clicks.push(id));
    return root;
  };
};
const host = (id: string): HTMLElement => {
  const el = document.createElement("div");
  el.innerHTML = `<div data-k-island="${id}"><button data-k="${id}.b">x</button></div><script type="application/json" id="k-state">${JSON.stringify({ stores: {}, islands: { [id]: {} } })}</script>`;
  document.body.append(el);
  return el;
};
const click = (root: Element): void => {
  const b = root.querySelector("button");
  if (b === null) throw new Error("fixture: no button");
  b.dispatchEvent(new MouseEvent("click", { bubbles: true }));
};

afterEach(() => {
  eventQueue.drop(0);
  document.body.innerHTML = "";
});

describe("resume called once per root", () => {
  it("keeps an event queued in a later root's island until that root resumes, then replays it once", () => {
    const clicks: string[] = [];
    const a = host("A");
    const b = host("B");
    click(b);
    click(a);
    expect(resume(a, { A: island("A", clicks) }).warnings).toEqual([]);
    expect(clicks).toEqual(["A"]);
    expect(eventQueue.pending()).toBe(1);
    expect(resume(b, { B: island("B", clicks) }).warnings).toEqual([]);
    expect(clicks).toEqual(["A", "B"]);
    expect(eventQueue.pending()).toBe(0);
  });
});
