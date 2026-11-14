// @vitest-environment happy-dom
// Spec: k.component, Conformance "A slot prop a component calls inside a `For` renders in that row's scope: removing the row disposes what the call rendered."
// Seed: 1337.
// ASSUMPTION: the compiled `For` is the `list` op from `@keel/runtime-dom/ops` (as in for-keyed-rows-0090); the slot prop is a plain function
// `(item, state) => Node` the component calls from its row callback; "what the call rendered" is observed through a text binding's reads.
import { scope, signal as newSignal } from "@keel/reactive";
import type { Signal } from "@keel/reactive";
import { mount } from "@keel/runtime-dom";
import { clone, list, template, text } from "@keel/runtime-dom/ops";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, flush } from "./fixtures.ts";

type Row = { id: string };
type RowState = { active(): boolean; selected(): boolean };
type Slot = (o: Row, s: RowState) => Node;

const ListT = template("<ul><!----></ul>");
const SpanT = template('<li><span class="s"></span></li>');

/** A component with a `For` over `rows` that calls its slot prop `option` once per row, in the row's scope. */
const Picker = (props: { rows: () => readonly Row[]; option: Slot }): Node => {
  const root = clone(ListT);
  const anchor = root.firstChild;
  if (anchor === null) throw new Error("fixture: template lacks anchor");
  list(
    anchor,
    () => props.rows(),
    (r) => r.id,
    (item) => props.option(item(), { active: () => false, selected: () => false }),
  );
  return root;
};

const setup = (initial: readonly Row[]) => {
  const rows: Signal<readonly Row[]> = signal(initial);
  const tick: Signal<number> = signal(0);
  const reads = new Map<string, number>();
  const option: Slot = (o) => {
    const li = clone(SpanT);
    const span = li.querySelector(".s");
    if (span === null) throw new Error("fixture: template lacks .s");
    text(span, () => {
      reads.set(o.id, (reads.get(o.id) ?? 0) + 1);
      return `${o.id}:${tick.get()}`;
    });
    return li;
  };
  const container = document.createElement("div");
  document.body.appendChild(container);
  const dispose = mount(() => Picker({ rows: () => rows.get(), option }), container);
  return {
    rows,
    tick,
    reads,
    container,
    teardown: () => {
      dispose();
      container.remove();
    },
  };
};

/** Signals are created in a scope (k.reactive E1203). */
const owner = scope(() => undefined);
const signal = <T>(v: T): Signal<T> => owner.run(() => newSignal(v));

const ids = (n: number): Row[] => Array.from({ length: n }, (_, i) => ({ id: `r${i}` }));

describe("k.component: a slot prop called inside a For renders in that row's scope", () => {
  it("A slot prop a component calls inside a `For` renders in that row's scope: removing the row disposes what the call rendered", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 2, max: 8 }), fc.nat(), async (n, pick) => {
        const m = setup(ids(n));
        const gone = pick % n;
        m.rows.set(ids(n).filter((_, i) => i !== gone));
        await flush();
        const before = new Map(m.reads);
        m.tick.set(1);
        await flush();
        expect(m.reads.get(`r${gone}`)).toBe(before.get(`r${gone}`));
        for (let i = 0; i < n; i++) {
          if (i === gone) continue;
          expect(m.reads.get(`r${i}`)).toBeGreaterThan(before.get(`r${i}`) ?? 0);
        }
        expect(m.container.querySelectorAll("li")).toHaveLength(n - 1);
        m.teardown();
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  it("the slot's call is made once per row and its bindings update while the row lives", async () => {
    const m = setup(ids(3));
    expect(Array.from(m.container.querySelectorAll(".s")).map((e) => e.textContent)).toEqual(["r0:0", "r1:0", "r2:0"]);
    m.tick.set(5);
    await flush();
    expect(Array.from(m.container.querySelectorAll(".s")).map((e) => e.textContent)).toEqual(["r0:5", "r1:5", "r2:5"]);
    m.teardown();
  });
});
