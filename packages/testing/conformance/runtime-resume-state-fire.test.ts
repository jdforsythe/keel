// @vitest-environment happy-dom
// Spec: k.runtime, clause "After resume, every server-rendered node keeps its identity, `state()` equals the serialized snapshot, and firing an event by id yields the same state and DOM as a client-only render."
// Property seed: 1337 (fc.assert seed below). A real compiled component (compile + evaluate), a real store, the real harness.
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import type { Ctx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
import { resume } from "@keel/runtime-dom/ops";
import { s } from "@keel/schema";
import { stores } from "@keel/store";
import { render } from "@keel/testing";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { compiled } from "./component-support.ts";
import { SEED, simCtx } from "./fixtures.ts";

const STORE_ID = "runtime.counter";
const COMPONENT_ID = "RuntimeCounter";
const BUTTON_ID = "runtime.inc";

const SOURCE = `
import { signal } from "@keel/reactive";
import { s } from "@keel/schema";
import { store, transaction, tx } from "@keel/store";

export const Props = s.object({ label: s.string() });
export const counter = store(s.object({ n: s.number() }), { n: 0 }, { id: "${STORE_ID}" });
export const bump = transaction(counter, "runtime.bump", s.object({}), (state) => ({ n: state.n + 1 }));
export const uses = [bump];

export default function ${COMPONENT_ID}(props: { label: string }) {
  const local = signal(0);
  return (
    <div id="runtime.root">
      <p id="runtime.stored">{counter.get("n")}</p>
      <p id="runtime.local">{local.get()}</p>
      <button id="${BUTTON_ID}" onClick={() => { tx(bump, {}); local.set(local.get() + 1); }}>{props.label}</button>
    </div>
  );
}
`;

interface Props {
  readonly label: string;
}

const c = compiled<Props>(COMPONENT_ID, SOURCE, s.object({ label: s.string() }));
const store = (() => {
  const found = stores().get(STORE_ID);
  if (found === undefined) throw new Error("fixture: compiled module did not register its store");
  return found;
})();
const initial = store.snapshot();

const flush = async (): Promise<void> => {
  for (let i = 0; i < 4; i++) await Promise.resolve();
};

const allNodes = (root: Node): Node[] => {
  const out: Node[] = [];
  const walk = (n: Node): void => {
    out.push(n);
    n.childNodes.forEach(walk);
  };
  walk(root);
  return out;
};

const stateRecord = (ids: readonly string[]): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const id of ids) {
    const st = stores().get(id);
    if (st !== undefined) out[id] = st.snapshot().state;
  }
  return out;
};

// outerHTML without data-k-island / data-k attributes and without comment nodes.
const normalized = (root: Element): string => {
  const copy = root.cloneNode(true);
  if (!(copy instanceof Element)) throw new Error("fixture: clone is not an element");
  const strip = (n: Node): void => {
    for (const child of Array.from(n.childNodes)) {
      if (child.nodeType === 8) n.removeChild(child);
      else strip(child);
    }
    if (n instanceof Element) {
      n.removeAttribute("data-k-island");
      n.removeAttribute("data-k");
    }
  };
  strip(copy);
  return copy.outerHTML;
};

const rootOf = (host: Element): Element => {
  const el = host.firstElementChild;
  if (el === null) throw new Error("fixture: no island root");
  return el;
};

const reset = (): void => {
  const r = store.restore(initial);
  if (!r.ok) throw new Error("fixture: reset failed");
};

const clickById = (id: string): void => {
  const el = document.getElementById(id);
  if (el === null) throw new Error(`fixture: no element ${id}`);
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
};

const clientOnly =
  (props: Props) =>
  (_p: Readonly<Record<string, unknown>>, ctx: Ctx): Node =>
    c.component(props, ctx);

// The island entry resume calls: decoded props arrive as a record.
const island = (p: Readonly<Record<string, unknown>>, ctx: Ctx): Node => {
  const label = p.label;
  if (typeof label !== "string") throw new Error("fixture: island props lack a label");
  return c.component({ label }, ctx);
};

describe("k.runtime: after resume, every server-rendered node keeps its identity, state() equals the serialized snapshot, and firing an event by id yields the same state and DOM as a client-only render", () => {
  it("compiles the fixture with zero diagnostics", () => {
    expect(compile([{ path: `${COMPONENT_ID}.tsx`, source: SOURCE }]).diagnostics).toEqual([]);
  });

  it("for any snapshot and click count, resume keeps node identity, state() equals the snapshot, and firing by id matches a client-only render in state and DOM", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 0, max: 5 }),
        fc.constantFrom("Go", "Add one", "Bump"),
        async (n, clicks, label) => {
          const props: Props = { label };
          const snapshot = { state: { n }, log: [], initial: { n: 0 } };
          // Server render: restore, render client-side into a scratch div, keep the island root's HTML, reset.
          expect(store.restore(snapshot).ok).toBe(true);
          const scratch = document.createElement("div");
          const disposeScratch = mount(clientOnly(props), scratch, { ctx: simCtx() });
          const serverRoot = rootOf(scratch);
          serverRoot.setAttribute("data-k-island", COMPONENT_ID);
          const islandHtml = serverRoot.outerHTML;
          disposeScratch();
          reset();
          expect(store.snapshot().state).toEqual({ n: 0 });
          const kstate = JSON.stringify({ stores: { [STORE_ID]: snapshot }, islands: { [COMPONENT_ID]: props } });

          // Resumed leg.
          const host = document.createElement("div");
          document.body.appendChild(host);
          host.innerHTML = `${islandHtml}<script type="application/json" id="k-state">${kstate}</script>`;
          const before = allNodes(host);
          const resumed = resume(host, { [COMPONENT_ID]: island }, { stores: { [STORE_ID]: store }, ctx: simCtx() });
          expect(resumed.warnings).toEqual([]);
          const after = allNodes(host);
          expect(after.length).toBe(before.length);
          after.forEach((node, i) => expect(node).toBe(before[i]));

          const restored = stateRecord([STORE_ID]);
          expect(restored).toEqual({ [STORE_ID]: { n } });
          expect(restored).not.toEqual({ [STORE_ID]: initial.state });

          for (let i = 0; i < clicks; i++) {
            clickById(BUTTON_ID);
            await flush();
          }
          const resumedState = stateRecord([STORE_ID]);
          const resumedText = c.ids.map((id) => document.getElementById(id)?.textContent ?? null);
          const resumedHtml = normalized(rootOf(host));
          host.remove();
          reset();

          // Harness leg.
          const t = render(c.component, { props, state: [[store, { n }]], ctx: simCtx() });
          for (let i = 0; i < clicks; i++) await t.fire(BUTTON_ID, { type: "click" });
          // state() lists every live store in the registry (fixtures share it); compare the ids k-state carries.
          const harnessState = { [STORE_ID]: t.state()[STORE_ID] };
          const harnessText = c.ids.map((id) => t.find(id).text);
          t.dispose();
          reset();

          // Client-only mount leg.
          expect(store.restore(snapshot).ok).toBe(true);
          const client = document.createElement("div");
          document.body.appendChild(client);
          const disposeClient = mount(clientOnly(props), client, { ctx: simCtx() });
          for (let i = 0; i < clicks; i++) {
            clickById(BUTTON_ID);
            await flush();
          }
          const clientState = stateRecord([STORE_ID]);
          const clientHtml = normalized(rootOf(client));
          disposeClient();
          client.remove();
          reset();

          expect(resumedState).toEqual({ [STORE_ID]: { n: n + clicks } });
          expect(resumedState).toEqual(harnessState);
          expect(resumedState).toEqual(clientState);
          c.ids.forEach((id, i) => expect(resumedText[i]).toBe(harnessText[i] ?? null));
          expect(resumedHtml).toBe(clientHtml);
        },
      ),
      { seed: SEED, numRuns: 25 },
    );
  });
});
