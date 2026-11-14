// Spec: k.persist, Conformance "`commitStores` reports one `save` event per changed store and none when nothing changed."
// Seed: 1337.
// ASSUMED (k.persist Server saves, k.sync Saves): the observer is added to the ctx passed to `commitStores`; `from` is the store's head before the save.
import { createCtx, observe } from "@keel/ctx";
import type { CtxEvent } from "@keel/ctx";
import { ok, s } from "@keel/schema";
import { commitStores } from "@keel/server";
import { store, transaction, tx } from "@keel/store";
import fc from "fast-check";
import { expect, it } from "vitest";

const Items = s.object({ items: s.array(s.int()) });
const Add = s.object({ n: s.int() });

const factory = () => {
  const lists = store(Items, { items: [] }, { id: "app.lists" });
  const todos = store(Items, { items: [] }, { id: "app.todos" });
  const addList = transaction(lists, "app.addList", Add, (state, { n }) => ({ items: [...state.items, n] }));
  const addTodo = transaction(todos, "app.addTodo", Add, (state, { n }) => ({ items: [...state.items, n] }));
  return { lists, todos, addList, addTodo };
};

it.skip("`commitStores` reports one `save` event per changed store and none when nothing changed", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.boolean(),
      fc.boolean(),
      fc.integer({ min: 1, max: 3 }),
      fc.integer({ min: 0, max: 3 }),
      async (changeLists, changeTodos, times, before) => {
        const ctx = createCtx({ mode: "sim", seed: 1337 });
        // Earlier saves give the lists store a head above 0.
        for (let i = 0; i < before; i++) {
          await commitStores(ctx, factory, (S) => {
            tx(S.addList, { n: i });
            return ok(null);
          });
        }
        const saves: Array<{ store: unknown; head: unknown; from: unknown }> = [];
        const events: CtxEvent[] = [];
        observe(ctx, (e) => {
          events.push(e);
          if (e.kind === "save") saves.push({ store: e.store, head: e.head, from: e.from });
        });
        const result = await commitStores(ctx, factory, (S) => {
          for (let i = 0; i < times; i++) {
            if (changeLists) tx(S.addList, { n: i });
            if (changeTodos) tx(S.addTodo, { n: i });
          }
          return ok(null);
        });
        expect(result.ok).toBe(true);
        const expected = [
          ...(changeLists ? [{ store: "app.lists", head: before + times, from: before }] : []),
          ...(changeTodos ? [{ store: "app.todos", head: times, from: 0 }] : []),
        ];
        const byStore = [...saves].sort((a, b) => String(a.store).localeCompare(String(b.store)));
        expect(byStore).toEqual(expected);
        if (!changeLists && !changeTodos) expect(events.filter((e) => e.kind === "save")).toEqual([]);
      },
    ),
    { seed: 1337, numRuns: 24 },
  );
});
