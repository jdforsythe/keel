import { mount } from "@keel/runtime-dom";
import { resume } from "@keel/runtime-dom/ops";
import { stores } from "@keel/store";
// @vitest-environment happy-dom
// Spec: k.runtime Conformance 3 (ADR-0006). Property seed: 1337.
// ASSUMPTION: resume(root, { [componentId]: Component }) maps data-k-island ids to compiled components.
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  COUNTER_HTML,
  Counter,
  KSTATE,
  SEED,
  STORE_ID,
  STORE_ISLAND_HTML,
  StoreCounter,
  click,
  countStore,
  flush,
  storeKState,
} from "./fixtures.ts";

const allNodes = (root: Node): Node[] => {
  const out: Node[] = [];
  const walk = (n: Node): void => {
    out.push(n);
    n.childNodes.forEach(walk);
  };
  walk(root);
  return out;
};

describe("k.runtime: after resume, every server-rendered node keeps its identity, state() equals the snapshot, and firing an event yields the same DOM as a client-only render", () => {
  it("after resume, every server-rendered node keeps its identity", () => {
    const host = document.createElement("div");
    host.innerHTML = COUNTER_HTML + KSTATE;
    const before = allNodes(host);
    resume(host, { Counter });
    const after = allNodes(host);
    expect(after.length).toBe(before.length);
    after.forEach((n, i) => expect(n).toBe(before[i]));
  });

  it("firing an event by id after resume yields the same DOM as a client-only render", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 5 }), async (clicks) => {
        const host = document.createElement("div");
        host.innerHTML = COUNTER_HTML + KSTATE;
        resume(host, { Counter });
        const client = document.createElement("div");
        const dispose = mount(Counter, client);
        for (let i = 0; i < clicks; i++) {
          const a = host.querySelector("#inc");
          const b = client.querySelector("#inc");
          if (a === null || b === null) throw new Error("no #inc");
          click(a);
          click(b);
          await flush();
        }
        const a = host.querySelector("#inc");
        const b = client.querySelector("#inc");
        expect(a?.textContent).toBe(String(3 + clicks));
        expect(a?.textContent).toBe(b?.textContent);
        dispose();
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  it("state() equals the serialized snapshot: after resume every store's value keyed by id equals the snapshot state", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1000 }), (n) => {
        const initial = countStore.snapshot();
        const snapshot = { state: { n }, log: [], initial: { n: 0 } };
        const host = document.createElement("div");
        host.innerHTML = STORE_ISLAND_HTML + storeKState(snapshot);
        const before = allNodes(host);
        const { warnings } = resume(host, { StoreCounter }, { stores: { [STORE_ID]: countStore } });
        expect(warnings).toEqual([]);
        const state: Record<string, unknown> = {};
        for (const id of [STORE_ID]) state[id] = stores().get(id)?.snapshot().state;
        expect(state).toEqual({ [STORE_ID]: snapshot.state });
        expect(state).not.toEqual({ [STORE_ID]: initial.state });
        const button = host.querySelector("#sinc");
        expect(button?.textContent).toBe(String(n));
        allNodes(host).forEach((node, i) => expect(node).toBe(before[i]));
        countStore.restore(initial);
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  it("firing a store-writing event by id after resume yields the same store state and island markup as a client-only render", async () => {
    const strip = (root: Element): string => {
      const copy = root.cloneNode(true);
      if (!(copy instanceof Element)) throw new Error("fixture: not an element");
      const walk = (n: Node): void => {
        for (const child of Array.from(n.childNodes)) {
          if (child.nodeType === 8) n.removeChild(child);
          else walk(child);
        }
        if (n instanceof Element) {
          n.removeAttribute("data-k-island");
          n.removeAttribute("data-k");
        }
      };
      walk(copy);
      return copy.outerHTML;
    };
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 1000 }), fc.integer({ min: 0, max: 5 }), async (n, clicks) => {
        const initial = countStore.snapshot();
        const snapshot = { state: { n }, log: [], initial: { n: 0 } };
        const host = document.createElement("div");
        host.innerHTML = STORE_ISLAND_HTML + storeKState(snapshot);
        resume(host, { StoreCounter }, { stores: { [STORE_ID]: countStore } });
        for (let i = 0; i < clicks; i++) {
          const el = host.querySelector("#sinc");
          if (el === null) throw new Error("no #sinc");
          click(el);
          await flush();
        }
        const resumedState = countStore.snapshot().state;
        const resumedHtml = strip(host.firstElementChild ?? host);
        countStore.restore(initial);

        countStore.restore(snapshot);
        const client = document.createElement("div");
        const dispose = mount(StoreCounter, client);
        for (let i = 0; i < clicks; i++) {
          const el = client.querySelector("#sinc");
          if (el === null) throw new Error("no #sinc");
          click(el);
          await flush();
        }
        const clientState = countStore.snapshot().state;
        const clientHtml = strip(client.firstElementChild ?? client);
        dispose();
        countStore.restore(initial);

        expect(resumedState).toEqual({ n: n + clicks });
        expect(resumedState).toEqual(clientState);
        expect(resumedHtml).toBe(clientHtml);
      }),
      { seed: SEED, numRuns: 25 },
    );
  });
});
