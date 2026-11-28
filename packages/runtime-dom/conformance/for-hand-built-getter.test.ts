// Spec: k.component, clause "Called as a function with `each` a getter, `For` renders a kept key's row anew for a new item object and keeps every other row's nodes."
// Seed: 1337.
// @vitest-environment happy-dom
// ASSUMPTION: `For({ each, key, children })` with `children: (item) => Node` called per row; `item` is the row's item value, not an accessor.
import { createCtx } from "@keel/ctx";
import { scope, signal as newSignal } from "@keel/reactive";
import type { Signal } from "@keel/reactive";
import { For, mount } from "@keel/runtime-dom";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, flush } from "./fixtures.ts";

const simCtx = createCtx({ mode: "sim", seed: 1337 });

/** Signals are created in a scope (k.reactive E1203). */
const owner = scope(() => undefined, { detached: true });
const signal = <T>(v: T): Signal<T> => owner.run(() => newSignal(v));

type Todo = { id: string; label: string };

const open = (initial: readonly Todo[]) => {
  const rows = signal<readonly Todo[]>(initial);
  const built = new Map<string, number>();
  const host = document.createElement("div");
  document.body.appendChild(host);
  const dispose = mount(
    () => {
      const ul = document.createElement("ul");
      const list: unknown = For({
        get each() {
          return rows.get();
        },
        key: "id",
        children: (item: Todo): Node => {
          built.set(item.id, (built.get(item.id) ?? 0) + 1);
          const li = document.createElement("li");
          const label = document.createElement("label");
          label.append(`${item.id} `);
          const input = document.createElement("input");
          label.append(input);
          const span = document.createElement("span");
          span.textContent = item.label;
          li.append(label, span);
          return li;
        },
      });
      if (!(list instanceof Node)) throw new Error("fixture: For did not return a node");
      ul.append(list);
      return ul;
    },
    host,
    { ctx: simCtx },
  );
  return {
    rows,
    built,
    lis: (): Element[] => Array.from(host.querySelectorAll("li")),
    teardown: () => {
      dispose();
      host.remove();
    },
  };
};

const ids = (n: number): string[] => Array.from({ length: n }, (_, i) => `k${i}`);
const todos = (keys: readonly string[], tag: string): Todo[] => keys.map((id) => ({ id, label: `${tag}:${id}` }));

describe("k.component: For called as a function renders a kept key's row anew for a new item object", () => {
  it("Called as a function with `each` a getter, `For` renders a kept key's row anew for a new item object", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 2, max: 8 }), fc.nat(), async (n, pick) => {
        const init = todos(ids(n), "a");
        const m = open(init);
        const at = pick % n;
        const next = init.map((t, i) => (i === at ? { ...t, label: "new" } : t));
        m.rows.set(next);
        await flush();
        const lis = m.lis();
        expect(lis).toHaveLength(n);
        expect(lis[at]?.querySelector("span")?.textContent).toBe("new");
        expect(m.built.get(`k${at}`)).toBe(2);
        m.teardown();
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  it("and keeps every other row's nodes", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 2, max: 8 }), fc.nat(), async (n, pick) => {
        const init = todos(ids(n), "a");
        const m = open(init);
        const before = m.lis();
        const at = pick % n;
        m.rows.set(init.map((t, i) => (i === at ? { ...t, label: "new" } : t)));
        await flush();
        const after = m.lis();
        after.forEach((el, i) => {
          if (i === at) expect(el).not.toBe(before[i]);
          else expect(el).toBe(before[i]);
        });
        ids(n).forEach((id, i) => expect(m.built.get(id)).toBe(i === at ? 2 : 1));
        m.teardown();
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  it("keeps the focus of a control in a row that did not change", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 2, max: 8 }), fc.nat(), async (n, pick) => {
        const init = todos(ids(n), "a");
        const m = open(init);
        const changed = pick % n;
        const kept = (changed + 1) % n;
        const input = m.lis()[kept]?.querySelector("input");
        if (input === null || input === undefined) throw new Error("fixture: no input");
        input.focus();
        m.rows.set(init.map((t, i) => (i === changed ? { ...t, label: "new" } : t)));
        await flush();
        expect(document.activeElement).toBe(input);
        m.teardown();
      }),
      { seed: SEED, numRuns: 25 },
    );
  });
});
