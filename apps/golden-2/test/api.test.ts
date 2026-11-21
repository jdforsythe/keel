import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { NoRows, sql } from "@keel/std-postgres";
import { describe, expect, it } from "vitest";
import { Box } from "../modules/kitchen/Box.schema.ts";
import { Recipe } from "../modules/kitchen/Recipe.schema.ts";
import { kitchenDb } from "../modules/kitchen/kitchenDb.server.ts";
import { recipeColumns } from "../modules/kitchen/recipeColumns.ts";
import { apiApp, apiCtx, asJson, draft } from "./simApi.ts";

/** The runtime body of `GET /api/recipes` (k.server): the `kitchen.box` loader `Result`. */
const BoxBody = s.object({
  id: s.string(),
  results: s.object({ "kitchen.box": s.object({ ok: s.literal(true), value: Box }) }),
});

describe("kitchen database", () => {
  it("starts each sim ctx with an empty, migrated recipes table of its own", async () => {
    const one = apiCtx(3);
    const two = apiCtx(3);
    const added = await kitchenDb(one).run(sql(NoRows)`
      insert into recipes (id, title, minutes, price_amount, price_currency, added_on)
      values (${one.random.id("Recipe")}, ${"Soup"}, ${30}, ${1800}, ${"JPY"}, ${"2026-11-10"})`);
    expect(added).toEqual({ ok: true, value: 1 });
    const mine = await kitchenDb(one).query(sql(Recipe)`${recipeColumns}`);
    const theirs = await kitchenDb(two).query(sql(Recipe)`${recipeColumns}`);
    expect(mine.ok ? mine.value.map((r) => r.title) : mine.error.code).toEqual(["Soup"]);
    expect(theirs).toEqual({ ok: true, value: [] });
  });

  it("lands one of two concurrent posts of one title; the other is the field error", async () => {
    const app = await apiApp(apiCtx(5));
    const [a, b] = await Promise.all([
      fetchJson(app, asJson("POST", "/api/recipes", draft("Soup", 30))),
      fetchJson(app, asJson("POST", "/api/recipes", draft("soup", 20))),
    ]);
    expect([a?.status, b?.status].sort()).toEqual([200, 422]);
    const listed = BoxBody.parse((await fetchJson(app, asJson("GET", "/api/recipes"))).body);
    expect(listed.ok ? listed.value.results["kitchen.box"].value.recipes.length : -1).toBe(1);
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
      id: "kitchen.box",
      results: { "kitchen.box": { ok: true, value: { recipes: [] } } },
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
    const id = parsed.ok ? (parsed.value.results["kitchen.box"].value.recipes[0]?.id ?? "") : "";
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

  it("refuses kitchen.add for a request with no user and writes nothing", async () => {
    const app = await apiApp(apiCtx(4), "");
    const refused = await fetchJson(app, asJson("POST", "/api/recipes", draft("Soup", 30)));
    expect(refused.status).toBe(403);
    expect(JSON.stringify(refused.body)).toContain("keel.denied");
    const listed = await fetchJson(app, asJson("GET", "/api/recipes"));
    expect(JSON.stringify(listed.body)).not.toContain("Soup");
  });
});
