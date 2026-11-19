// @vitest-environment happy-dom
// rfc:0071 (backlog 0212): what resume reports to ctx observers beyond the conformance clause.
import { type CtxEvent, createCtx, observe } from "@keel/ctx";
import { clone, on, resume, template } from "@keel/runtime-dom/ops";
import { describe, expect, it } from "vitest";

const HTML =
  '<div data-k-island="F"><input id="pw" data-k="pw" type="password"><textarea id="note" data-k="note">n</textarea>' +
  '<select id="pick" data-k="pick"><option value="a">a</option><option value="b">b</option></select>' +
  '<input id="box" data-k="box" type="checkbox"><input id="q" data-k="q" value="v"></div>';
const T = template(HTML);
const handled: string[] = [];
const F = (): Node => {
  const root = clone(T);
  for (const id of ["pw", "note", "pick", "box", "q"])
    on(id, "input", (e: Event) => {
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement)
        handled.push(`${id}=${t.value}`);
    });
  return root;
};
const ROUTE = {
  id: "orders.show",
  path: "/orders/:id",
  href: "/orders/7?tab=a",
  params: { id: 7 },
  search: { tab: "a" },
};

const page = (state: unknown) => {
  handled.length = 0;
  const host = document.createElement("div");
  host.innerHTML = `${HTML}<script type="application/json" id="k-state">${JSON.stringify(state)}</script>`;
  document.body.appendChild(host);
  const ctx = createCtx({ seed: 1, mode: "sim" });
  const events: CtxEvent[] = [];
  observe(ctx, (e) => {
    events.push(e);
  });
  const el = (id: string): Element => {
    const found = host.querySelector(`#${id}`);
    if (found === null) throw new Error(`no #${id}`);
    return found;
  };
  return { host, ctx, events, el };
};

describe("resume reports to ctx observers (rfc:0071)", () => {
  it("the served route arrives with encoded params, its href, and no schemas", () => {
    const { host, ctx, events } = page({ stores: {}, islands: { F: {} }, route: ROUTE });
    resume(host, { F }, { ctx });
    expect(events).toEqual([
      {
        kind: "nav",
        href: "/orders/7?tab=a",
        route: { id: "orders.show", path: "/orders/:id", params: { id: 7 }, search: { tab: "a" }, schemas: {} },
      },
    ]);
    host.remove();
  });

  it("typed-before-load textarea, select and password report in document order, the password masked; a checkbox does not", () => {
    const { host, ctx, events, el } = page({ stores: {}, islands: { F: {} } });
    const pw = el("pw");
    const note = el("note");
    const pick = el("pick");
    const box = el("box");
    if (!(pw instanceof HTMLInputElement) || !(note instanceof HTMLTextAreaElement)) throw new Error("fixture");
    if (!(pick instanceof HTMLSelectElement) || !(box instanceof HTMLInputElement)) throw new Error("fixture");
    pw.value = "hunter2";
    note.value = "typed";
    pick.value = "b";
    box.checked = true;
    resume(host, { F }, { ctx });
    expect(events).toEqual([
      { kind: "fire", id: "pw", event: { type: "input", value: "xxxxxxx" } },
      { kind: "fire", id: "note", event: { type: "input", value: "typed" } },
      { kind: "fire", id: "pick", event: { type: "input", value: "b" } },
    ]);
    expect(handled).toEqual(["pw=hunter2", "note=typed", "pick=b"]);
    host.remove();
  });

  it("a malformed route reports no nav; a field with a queued input is not fired twice", () => {
    const { host, ctx, events, el } = page({ stores: {}, islands: { F: {} }, route: { id: 1 } });
    const q = el("q");
    if (!(q instanceof HTMLInputElement)) throw new Error("fixture");
    q.value = "vw";
    q.dispatchEvent(new Event("input", { bubbles: true }));
    resume(host, { F }, { ctx });
    expect(events).toEqual([{ kind: "fire", id: "q", event: { type: "input", value: "vw" } }]);
    expect(handled).toEqual(["q=vw"]);
    host.remove();
  });

  it("without a ctx, typed fields still reach their handlers", () => {
    const { host, el } = page({ stores: {}, islands: { F: {} }, route: ROUTE });
    const q = el("q");
    if (!(q instanceof HTMLInputElement)) throw new Error("fixture");
    q.value = "w";
    resume(host, { F });
    expect(handled).toEqual(["q=w"]);
    host.remove();
  });
});
