// @vitest-environment happy-dom
// Property seed: 1337. Resume of islands whose content includes structural regions (<!--[-->...<!--]-->).
import { signal } from "@keel/reactive";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { eventQueue } from "../src/internal/eventQueue.ts";
import { clone, cond, list, on, resume, template, text } from "../src/ops/index.ts";
import { SEED } from "./support.ts";
import { testCtx } from "./testCtx.ts";

const allNodes = (root: Node): Node[] => {
  const out: Node[] = [root];
  for (const c of root.childNodes) out.push(...allNodes(c));
  return out;
};
const fire = (el: Element): void => {
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
};

// Island "L": a list of names plus an "add" button and a conditional footer.
const L_T = template(
  '<div data-k-island="L"><button id="add" data-k="add">+</button><ul><!----></ul><p><!----></p></div>',
);
const LI = template("<li></li>");
const FOOT = template('<em id="many">many</em>');
const L = (props: Readonly<Record<string, unknown>>): Node => {
  const initial = Array.isArray(props.names) ? props.names.map(String) : [];
  const names = signal(initial);
  const root = clone(L_T);
  const ul = root.querySelector("ul");
  const p = root.querySelector("p");
  if (ul === null || p === null || ul.lastChild === null || p.lastChild === null) throw new Error("fixture");
  list(
    ul.lastChild,
    () => names.get(),
    (n) => n,
    (n) => {
      const li = clone(LI);
      text(li, () => n());
      return li;
    },
  );
  cond(
    p.lastChild,
    () => names.get().length > 2,
    () => clone(FOOT),
  );
  on("add", "click", () => names.set([...names.get(), `n${names.get().length}`]));
  return root;
};
const server = (names: readonly string[]): string =>
  `<div data-k-island="L"><button id="add" data-k="add">+</button><ul><!--[-->${names
    .map((n) => `<li>${n}</li>`)
    .join(
      "",
    )}<!--]--><!----></ul><p><!--[-->${names.length > 2 ? '<em id="many">many</em>' : ""}<!--]--><!----></p></div>` +
  `<script type="application/json" id="k-state">${JSON.stringify({ stores: {}, islands: { L: { names } } })}</script>`;

describe("resume with structural regions", () => {
  it("claims list rows and cond branches in place, then behaves like a client render", () => {
    const names = fc.uniqueArray(fc.stringMatching(/^[a-z]{1,4}$/), { maxLength: 5 });
    fc.assert(
      fc.property(names, fc.nat(3), (ns, clicks) => {
        const host = document.createElement("div");
        host.innerHTML = server(ns);
        const before = allNodes(host);
        const { warnings } = resume(host, { L }, { ctx: testCtx });
        expect(warnings).toEqual([]);
        const after = allNodes(host);
        expect(after.length).toBe(before.length);
        after.forEach((n, i) => expect(n).toBe(before[i]));
        const add = host.querySelector("#add");
        if (add === null) throw new Error("no #add");
        for (let i = 0; i < clicks; i++) fire(add);
        const expected = [...ns];
        for (let i = 0; i < clicks; i++) expected.push(`n${expected.length}`);
        expect([...host.querySelectorAll("li")].map((l) => l.textContent)).toEqual(expected);
        expect(host.querySelector("#many") !== null).toBe(expected.length > 2);
        for (const li of before.filter((n) => n instanceof HTMLLIElement)) expect(host.contains(li)).toBe(true);
      }),
      { seed: SEED, numRuns: 50 },
    );
  });

  it("E1253 when the server rendered a different number of rows; the island re-renders on the client", () => {
    const host = document.createElement("div");
    host.innerHTML = server(["a", "b"]).replace('"names":["a","b"]', '"names":["a"]');
    const { warnings } = resume(host, { L }, { ctx: testCtx });
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain("E1253");
    expect([...host.querySelectorAll("li")].map((l) => l.textContent)).toEqual(["a"]);
  });

  it("E1253 when an island has no compiled component; other islands still resume", () => {
    const host = document.createElement("div");
    host.innerHTML = `<div data-k-island="Nope"></div>${server(["a"])}`;
    const { warnings } = resume(host, { L }, { ctx: testCtx });
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain('"Nope"');
    const add = host.querySelector("#add");
    if (add === null) throw new Error("no #add");
    fire(add);
    expect(host.querySelectorAll("li").length).toBe(2);
  });

  it("events queued for an island that falls back (E1253) or has no component are dropped, not replayed", () => {
    for (const kind of ["fallback", "missing"]) {
      const host = document.createElement("div");
      document.body.appendChild(host);
      host.innerHTML =
        kind === "fallback" ? server(["a", "b"]).replace('"names":["a","b"]', '"names":["a"]') : server(["a"]);
      const add = host.querySelector("#add");
      if (add === null) throw new Error("no #add");
      fire(add);
      fire(add);
      expect(eventQueue.pending()).toBe(2);
      const { warnings } = resume(host, kind === "fallback" ? { L } : {}, { ctx: testCtx });
      expect(warnings.length).toBe(1);
      expect(eventQueue.pending()).toBe(0);
      expect(host.querySelectorAll("li").length).toBe(1);
      const again = host.querySelector("#add");
      if (again === null) throw new Error("no #add");
      fire(again);
      expect(eventQueue.pending()).toBe(0);
      expect(host.querySelectorAll("li").length).toBe(kind === "fallback" ? 2 : 1);
      host.remove();
    }
  });
});
