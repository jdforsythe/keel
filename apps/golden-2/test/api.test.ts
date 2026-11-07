import { createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { isolate } from "@keel/store";
import { properties } from "@keel/testing";
import { afterEach, describe, expect, it } from "vitest";
import KitchenApi from "../modules/kitchen/KitchenApi.ts";
import { NewRecipe } from "../modules/kitchen/NewRecipe.schema.ts";
import { addRecipe } from "../modules/kitchen/addRecipe.ts";
import { boxStores } from "../modules/kitchen/boxStores.ts";
import { loadRecipes } from "../modules/kitchen/loadRecipes.server.ts";
import { postFavorite } from "../modules/kitchen/postFavorite.server.ts";
import { postRecipe } from "../modules/kitchen/postRecipe.server.ts";
import { toggleFavorite } from "../modules/kitchen/toggleFavorite.ts";
import { BoxReply } from "../modules/recipes/BoxReply.schema.ts";
import { apiApp, asJson } from "./simApi.ts";

const scopes: { dispose(): void }[] = [];
afterEach(() => {
  for (const sc of scopes.splice(0)) sc.dispose();
});

/** Stores for one request, in a fresh isolated scope (k.testing: factory stores need a scope). */
const fresh = () => {
  const sc = scope(() => undefined);
  isolate(sc);
  scopes.push(sc);
  return sc.run(boxStores);
};

describe("kitchen transactions", () => {
  it("addRecipe holds the box invariant under generated states and payloads", async () => {
    const { addRecipe } = fresh();
    await properties(addRecipe);
  });
  it("toggleFavorite holds the box invariant and leaves unknown ids unchanged", async () => {
    const { toggleFavorite } = fresh();
    await properties(toggleFavorite);
  });
  it("builds the transactions from the factory", () => {
    const st = fresh();
    expect(typeof addRecipe).toBe("function");
    expect(typeof toggleFavorite).toBe("function");
    expect(st.box.id).toBe("kitchen.box");
    expect(typeof NewRecipe.parse).toBe("function");
    expect(typeof loadRecipes).toBe("object");
    expect(typeof postRecipe).toBe("object");
    expect(typeof postFavorite).toBe("object");
    expect(typeof KitchenApi).toBe("function");
  });
});

const fetchJson = async (app: Awaited<ReturnType<typeof apiApp>>, req: Request) => {
  const res = await app.fetch(req);
  const body: unknown = await res.json();
  return { status: res.status, body };
};

describe("kitchen endpoints", () => {
  it("creates a recipe, lists it, toggles it, and refuses a duplicate title and an unknown id", async () => {
    const app = await apiApp(createCtx({ mode: "sim", seed: 3 }));
    const empty = await fetchJson(app, asJson("GET", "/api/recipes"));
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual({
      id: "kitchen.recipes",
      results: { "kitchen.recipes": { ok: true, value: { recipes: [] } } },
    });

    const added = await fetchJson(app, asJson("POST", "/api/recipes", { title: "Soup", minutes: 30 }));
    expect(added).toEqual({ status: 200, body: { ok: true, value: null } });

    const listed = await fetchJson(app, asJson("GET", "/api/recipes"));
    const body = JSON.stringify(listed.body);
    expect(body).toContain('"title":"Soup"');
    expect(body).toContain('"favorite":false');
    const parsed = BoxReply.parse(listed.body);
    const id = parsed.ok ? (parsed.value.results["kitchen.recipes"].value.recipes[0]?.id ?? "") : "";
    expect(id).not.toBe("");

    const dup = await fetchJson(app, asJson("POST", "/api/recipes", { title: "SOUP", minutes: 5 }));
    expect(dup.status).toBe(422);
    expect(dup.body).toEqual({
      ok: false,
      error: { code: "keel.fields", message: "Already in the box", data: { title: "Already in the box" } },
    });

    const bad = await fetchJson(app, asJson("POST", "/api/recipes", { title: "", minutes: 0 }));
    expect(bad.status).toBe(422);

    const toggled = await fetchJson(app, asJson("POST", `/api/recipes/${id}/favorite`, {}));
    expect(toggled).toEqual({ status: 200, body: { ok: true, value: null } });
    expect(JSON.stringify((await fetchJson(app, asJson("GET", "/api/recipes"))).body)).toContain('"favorite":true');

    const missing = createCtx({ mode: "sim", seed: 99 }).random.id("Recipe");
    const gone = await fetchJson(app, asJson("POST", `/api/recipes/${missing}/favorite`, {}));
    expect(gone.status).toBe(404);
    expect(JSON.stringify(gone.body)).toContain("keel.notFound");
  });
});
