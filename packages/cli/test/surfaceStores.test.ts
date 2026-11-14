// k.compat Surface: `surfaceOf` lists each store a loader's or action's `stores` factory creates, with its state and
// payload schemas, through the `storesOf` the evaluation hands it; without one, no store.
import { action, loader, manifest } from "@keel/router";
import { routeActions } from "@keel/router/internal";
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
  const routes = manifest({
    "m.home": {
      path: "/m",
      component: Page,
      loader: loader({ output: s.object({}), stores: factory }, async () => ok({})),
    },
  });
  routes.actions({ "m.home": { POST: action({ input: s.object({}), stores: factory }, async () => ok(null)) } });
  const bound = new Map<object, unknown>([[routes.routes["m.home"], routeActions.get(routes.routes["m.home"])]]);
  const actionsOf = (def: object): unknown => bound.get(def);
  return { manifests: [{ file: "modules/m/routes.ts", routes }], actionsOf, services: [], sources: {} };
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
