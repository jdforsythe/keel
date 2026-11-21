import { scope } from "@keel/reactive";
import { explore, properties } from "@keel/testing";
import { expect, it } from "vitest";
import { savedStores } from "../modules/shopping/savedStores.ts";

const { saved, add, toggle, remove } = scope(() => undefined).run(() => savedStores());

it("starts empty", () => {
  expect(saved.snapshot().state).toEqual({ items: [] });
});

it("add keeps every invariant and undoes exactly", async () => {
  await properties(add, { runs: 100, seed: 11 });
});

it("toggle keeps every invariant and undoes exactly", async () => {
  await properties(toggle, { runs: 100, seed: 11 });
});

it("remove keeps every invariant and undoes exactly", async () => {
  await properties(remove, { runs: 100, seed: 11 });
});

it("reaches no state that breaks an invariant in five steps over three ids and two names", () => {
  const ids = ["i1", "i2", "i3"];
  const r = explore([add, toggle, remove], {
    depth: 5,
    payloads: {
      "shopping.saved.add": ids.flatMap((id) => ["Milk", "Eggs"].map((name) => ({ id, name }))),
      "shopping.saved.toggle": ids.map((id) => ({ id })),
      "shopping.saved.remove": ids.map((id) => ({ id })),
    },
  });
  expect(r.depth).toBe(5);
  expect(r.states.length).toBeGreaterThan(50);
});
