// @vitest-environment happy-dom
// k.store Transactions with k.testing Harness: a `tx` called while a route component renders. Seed: 1337 (no generated inputs).
import { scope } from "@keel/reactive";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { store, transaction, tx } from "@keel/store";
import { renderRoute } from "@keel/testing";
import { expect, it } from "vitest";

let made: { readonly value: ReturnType<typeof makeStore> } | undefined;
function makeStore() {
  return store(s.object({ n: s.int() }), { n: 0 }, { id: "test.txInRender" });
}
scope(
  () => {
    made = { value: makeStore() };
  },
  { detached: true },
);
const held = made?.value;
if (held === undefined) throw new Error("test: scope did not run");
const seed = transaction(held, "test.txInRender.seed", s.object({ n: s.int() }), (_st, p) => ({ n: p.n }));

const c = contract("tr", { "tr.page": { path: "/tr" } });
const routes = manifest(c, {
  "tr.page": {
    component: () => {
      tx(seed, { n: 3 });
      const main = document.createElement("main");
      main.id = "tr.main";
      return main;
    },
  },
});

it("a tx while a route component renders rejects with the write's E1201, not an empty page", async () => {
  await expect(renderRoute("tr.page", { routes })).rejects.toThrow(/keel\.unexpected.*E1201 write to a signal/);
});
