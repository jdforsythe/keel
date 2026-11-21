// k.compat Surface: `surfaceOf` lists each store a bound loader's or action's `stores` factory creates, with its state
// and payload schemas, through the `storesOf` the evaluation hands it; without one, no store.
import { action, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { bindingsOf } from "@keel/router/internal";
import { ok, s } from "@keel/schema";
import { store, transaction } from "@keel/store";
import { storeShapes } from "@keel/store/internal";
import { describe, expect, it } from "vitest";
import { surfaceOf } from "../src/internal/surfaceOf.ts";

const Page = () => document.createElement("div");
const factory = () => {
  const st = store(s.object({ a: s.string() }, { closed: true }), { a: "" }, { id: "m.s" });
  return { st, add: transaction(st, "m.add", s.object({ n: s.int() }), (x) => x) };
};

function evaluated() {
  const m = contract("m", {
    "m.home": { path: "/m" },
    "m.feed": { method: "GET", path: "/api/m", output: s.object({}) },
  });
  const routes = manifest(m, {
    "m.home": {
      component: Page,
      loader: loader(m, "m.home", { output: s.object({}), stores: factory }, async () => ok({})),
      POST: action(m, "m.home", { input: s.object({}), stores: factory }, async () => ok(null)),
    },
    "m.feed": { loader: loader(m, "m.feed", { stores: factory }, async () => ok({})) },
  });
  const bindings = [...bindingsOf(routes).values()].map((b) => b.binding);
  return { contracts: routes.contracts, bindings, callers: {}, sources: {} };
}

describe("surfaceOf stores", () => {
  it("records each factory store once, by id, with JSON Schemas", () => {
    const d = surfaceOf({ ...evaluated(), storesOf: (f) => (typeof f === "function" ? storeShapes(() => f()) : []) });
    expect(d.stores).toEqual({
      "m.s": {
        state: expect.objectContaining({ type: "object", required: ["a"] }),
        transactions: { "m.add": expect.objectContaining({ type: "object", required: ["n"] }) },
      },
    });
  });

  it("is empty without storesOf", () => {
    expect(surfaceOf(evaluated()).stores).toEqual({});
  });
});
