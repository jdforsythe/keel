import { createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { isolate } from "@keel/store";
import { properties } from "@keel/testing";
import { afterEach, describe, expect, it } from "vitest";
import { Box } from "../modules/kitchen/Box.schema.ts";
import { NewRecipe } from "../modules/kitchen/NewRecipe.schema.ts";
import { addRecipe } from "../modules/kitchen/addRecipe.ts";
import { boxStores } from "../modules/kitchen/boxStores.ts";
import { loadRecipes } from "../modules/kitchen/loadRecipes.server.ts";
import { postFavorite } from "../modules/kitchen/postFavorite.server.ts";
import { postRecipe } from "../modules/kitchen/postRecipe.server.ts";
import { toggleFavorite } from "../modules/kitchen/toggleFavorite.ts";
import { apiApp, apiCtx, asJson, draft } from "./simApi.ts";

/** The runtime body of `GET /api/recipes` (k.server): the `kitchen.recipes` loader `Result`. */
const BoxBody = s.object({
  id: s.string(),
  results: s.object({ "kitchen.recipes": s.object({ ok: s.literal(true), value: Box }) }),
});

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
  });
});

const fetchJson = async (app: Awaited<ReturnType<typeof apiApp>>, req: Request) => {
  const res = await app.fetch(req);
  const body: unknown = await res.json();
  return { status: res.status, body };
};

describe("kitchen endpoints", () => {
  it("creates a recipe, lists it, toggles it, and refuses a duplicate title and an unknown id", async () => {
    const app = await apiApp(apiCtx(3));
    const empty = await fetchJson(app, asJson("GET", "/api/recipes"));
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual({
      id: "kitchen.recipes",
      results: { "kitchen.recipes": { ok: true, value: { recipes: [] } } },
    });

    const added = await fetchJson(app, asJson("POST", "/api/recipes", draft("Soup", 30, 1800, "JPY")));
    expect(added).toEqual({ status: 200, body: { ok: true, value: {} } });

    const listed = await fetchJson(app, asJson("GET", "/api/recipes"));
    const body = JSON.stringify(listed.body);
    expect(body).toContain('"title":"Soup"');
    expect(body).toContain('"favorite":false');
    expect(body).toContain('"price":{"amount":1800,"currency":"JPY"}');
    expect(body).toContain('"addedOn":"2026-11-10"');
    const parsed = BoxBody.parse(listed.body);
    const id = parsed.ok ? (parsed.value.results["kitchen.recipes"].value.recipes[0]?.id ?? "") : "";
    expect(id).not.toBe("");

    const dup = await fetchJson(app, asJson("POST", "/api/recipes", draft("SOUP", 5)));
    expect(dup.status).toBe(422);
    expect(dup.body).toEqual({
      ok: false,
      error: { code: "keel.fields", message: "Already in the box", data: { title: "Already in the box" } },
    });

    const bad = await fetchJson(app, asJson("POST", "/api/recipes", draft("", 0)));
    expect(bad.status).toBe(422);
    const flagged = await fetchJson(app, asJson("POST", "/api/recipes", draft("a\u202Eb", 5)));
    expect(flagged.status).toBe(422);
    const noPrice = await fetchJson(app, asJson("POST", "/api/recipes", { title: "Pie", minutes: 5 }));
    expect(noPrice.status).toBe(422);

    const toggled = await fetchJson(app, asJson("POST", `/api/recipes/${id}/favorite`, {}));
    expect(toggled).toEqual({ status: 200, body: { ok: true, value: {} } });
    expect(JSON.stringify((await fetchJson(app, asJson("GET", "/api/recipes"))).body)).toContain('"favorite":true');

    const missing = createCtx({ mode: "sim", seed: 99 }).random.id("Recipe");
    const gone = await fetchJson(app, asJson("POST", `/api/recipes/${missing}/favorite`, {}));
    expect(gone.status).toBe(404);
    expect(JSON.stringify(gone.body)).toContain("keel.notFound");
  });
});
