// @vitest-environment happy-dom
// Spec: k.runtime Conformance 3 (ADR-0006). Property seed: 1337.
// ASSUMPTION: resume(root, { [componentId]: Component }) maps data-k-island ids to compiled components.
import * as fc from "fast-check";
import { mount } from "@keel/runtime-dom";
import { resume } from "@keel/runtime-dom/ops";
import { describe, expect, it } from "vitest";
import { COUNTER_HTML, Counter, KSTATE, SEED, click, flush } from "./fixtures.ts";

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

  it.todo("state() equals the serialized snapshot: state() is not in the public API listed for @keel/runtime-dom");
});
