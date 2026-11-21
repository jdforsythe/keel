import { explore, properties } from "@keel/testing";
import { expect, it } from "vitest";
import { add } from "../modules/shopping/add.transaction.ts";
import { items } from "../modules/shopping/items.store.ts";
import { remove } from "../modules/shopping/remove.transaction.ts";
import { show } from "../modules/shopping/show.transaction.ts";
import { toggle } from "../modules/shopping/toggle.transaction.ts";

it("starts empty on the To buy tab", () => {
  expect(items.snapshot().state).toEqual({ items: [], show: "toBuy" });
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

it("show keeps every invariant and undoes exactly", async () => {
  await properties(show, { runs: 100, seed: 11 });
});

it("reaches no state that breaks an invariant in five steps over three ids and two names", () => {
  const ids = ["i1", "i2", "i3"];
  const r = explore([add, toggle, remove, show], {
    depth: 5,
    payloads: {
      "shopping.items.add": ids.flatMap((id) => ["Milk", "Eggs"].map((name) => ({ id, name }))),
      "shopping.items.toggle": ids.map((id) => ({ id })),
      "shopping.items.remove": ids.map((id) => ({ id })),
    },
  });
  expect(r.depth).toBe(5);
  expect(r.states.length).toBeGreaterThan(50);
});
