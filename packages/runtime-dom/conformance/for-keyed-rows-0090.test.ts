import { signal } from "@keel/reactive";
import type { Signal } from "@keel/reactive";
import { mount } from "@keel/runtime-dom";
import { clone, list, template, text } from "@keel/runtime-dom/ops";
// @vitest-environment happy-dom
// Spec: k.component, Control flow and Conformance clause "Replacing `each` with new objects of the same keys keeps each surviving row's element and `document.activeElement`, and updates the changed row's text."
// RFC 0090, ADR-0113. Property seed: 1337.
// ASSUMPTION: the compiled `For` is the `list` op from `@keel/runtime-dom/ops`: list(anchor, each, key, render(item, index), empty?),
// where `item()` reads the row's current item. The hand-built `For` keeps its present behavior (RFC 0090 D3), so it is not tested here.
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, flush } from "./fixtures.ts";

type Todo = { id: string; label: string };

const RowT = template('<li><input class="c"><span class="t"></span></li>');

/** A compiled-style row: the item is read at the row body's top level (as a component getter prop does) and again inside a binding. */
const ListT = template("<ul><!----></ul>");

const mountList = (initial: readonly Todo[]) => {
  const slot: { rows?: Signal<readonly Todo[]> } = {};
  const container = document.createElement("div");
  document.body.appendChild(container);
  let renders = 0;
  const dispose = mount(() => {
    const rows = signal<readonly Todo[]>(initial);
    slot.rows = rows;
    const root = clone(ListT);
    const anchor = root.firstChild;
    if (anchor === null) throw new Error("fixture: template lacks anchor");
    list(
      anchor,
      () => rows.get(),
      (t) => t.id,
      (item) => {
        renders++;
        const row = clone(RowT);
        const top = item(); // top-level read of the item: must not re-render the row
        row.setAttribute("data-first", top.id);
        const span = row.querySelector(".t");
        if (span === null) throw new Error("fixture: template lacks .t");
        text(span, () => item().label);
        return row;
      },
    );
    return root;
  }, container);
  const rows = slot.rows;
  if (rows === undefined) throw new Error("fixture: component did not run");
  const host = container;
  const lis = (): Element[] => Array.from(host.querySelectorAll("li"));
  const teardown = (): void => {
    dispose();
    container.remove();
  };
  return { rows, host, lis, renders: () => renders, teardown };
};

const ids = (n: number): string[] => Array.from({ length: n }, (_, i) => `k${i}`);
const todos = (keys: readonly string[], tag: string): Todo[] => keys.map((id) => ({ id, label: `${tag}:${id}` }));

describe("k.component: a For row whose key stays keeps its element, focus and bindings update from the new item", () => {
  it("Replacing `each` with new objects of the same keys keeps each surviving row's element", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 8 }), async (n) => {
        const m = mountList(todos(ids(n), "a"));
        const before = m.lis();
        expect(before).toHaveLength(n);
        m.rows.set(todos(ids(n), "b"));
        await flush();
        const after = m.lis();
        expect(after).toHaveLength(n);
        after.forEach((el, i) => expect(el).toBe(before[i]));
        m.teardown();
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  it("Replacing `each` with new objects of the same keys keeps document.activeElement on a focused control in a row", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 8 }), fc.nat(), async (n, pick) => {
        const m = mountList(todos(ids(n), "a"));
        const at = pick % n;
        const input = m.lis()[at]?.querySelector("input");
        if (input === null || input === undefined) throw new Error("no input");
        input.focus();
        expect(document.activeElement).toBe(input);
        m.rows.set(todos(ids(n), "b"));
        await flush();
        expect(document.activeElement).toBe(input);
        expect(m.lis()[at]?.querySelector("input")).toBe(input);
        m.teardown();
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  it("Replacing `each` with new objects of the same keys updates the changed row's text", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 8 }), fc.nat(), fc.string({ minLength: 1, maxLength: 8 }), async (n, pick, word) => {
        const m = mountList(todos(ids(n), "a"));
        const at = pick % n;
        const next = todos(ids(n), "a").map((t, i) => (i === at ? { ...t, label: `new-${word}` } : { ...t }));
        m.rows.set(next);
        await flush();
        m.lis().forEach((el, i) => {
          expect(el.querySelector(".t")?.textContent).toBe(i === at ? `new-${word}` : `a:k${i}`);
        });
        m.teardown();
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  it("A top-level read of the item in the row body re-renders nothing when the item object changes", async () => {
    const m = mountList(todos(ids(4), "a"));
    const first = m.renders();
    expect(first).toBe(4);
    m.rows.set(todos(ids(4), "b"));
    await flush();
    expect(m.renders()).toBe(first);
    m.teardown();
  });

  it("An insert leaves every other row's element identical and in order", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 8 }), fc.nat(), async (n, pick) => {
        const m = mountList(todos(ids(n), "a"));
        const before = m.lis();
        const at = pick % (n + 1);
        const inserted: Todo = { id: "new", label: "a:new" };
        const next = todos(ids(n), "a");
        next.splice(at, 0, inserted);
        m.rows.set(next);
        await flush();
        const after = m.lis();
        expect(after).toHaveLength(n + 1);
        const survivors = after.filter((_, i) => i !== at);
        survivors.forEach((el, i) => expect(el).toBe(before[i]));
        expect(after[at]?.querySelector(".t")?.textContent).toBe("a:new");
        m.teardown();
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  it("An insert keeps document.activeElement on a focused control in another row", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 8 }), fc.nat(), fc.nat(), async (n, pickFocus, pickAt) => {
        const m = mountList(todos(ids(n), "a"));
        const input = m.lis()[pickFocus % n]?.querySelector("input");
        if (input === null || input === undefined) throw new Error("no input");
        input.focus();
        const next = todos(ids(n), "a");
        next.splice(pickAt % (n + 1), 0, { id: "new", label: "a:new" });
        m.rows.set(next);
        await flush();
        expect(document.activeElement).toBe(input);
        m.teardown();
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  it("A removal leaves every other row's element identical and in order", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 2, max: 8 }), fc.nat(), async (n, pick) => {
        const m = mountList(todos(ids(n), "a"));
        const before = m.lis();
        const at = pick % n;
        const next = todos(ids(n), "a");
        next.splice(at, 1);
        m.rows.set(next);
        await flush();
        const after = m.lis();
        expect(after).toHaveLength(n - 1);
        const survivors = before.filter((_, i) => i !== at);
        after.forEach((el, i) => expect(el).toBe(survivors[i]));
        m.teardown();
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  it("A removal keeps document.activeElement on a focused control in a surviving row", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 2, max: 8 }), fc.nat(), async (n, pick) => {
        const m = mountList(todos(ids(n), "a"));
        const gone = pick % n;
        const keep = (gone + 1) % n;
        const input = m.lis()[keep]?.querySelector("input");
        if (input === null || input === undefined) throw new Error("no input");
        input.focus();
        m.rows.set(todos(ids(n), "a").filter((_, i) => i !== gone));
        await flush();
        expect(document.activeElement).toBe(input);
        m.teardown();
      }),
      { seed: SEED, numRuns: 25 },
    );
  });
});
