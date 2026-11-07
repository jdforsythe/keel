// Hidden acceptance suite for evals/tasks/golden-2 (TASK.md "Acceptance" 5). pass.ts copies it to
// apps/golden-2/test/__acceptance.test.ts, runs it with the app's vitest config, and deletes it. It reaches the app only
// through what TASK.md pins: the default `topology`, `routes` of modules kitchen and recipes, route ids, element ids.
import { createCtx } from "@keel/ctx";
import { createApp } from "@keel/server";
import { type A11yNode, renderRoute } from "@keel/testing";
import { describe, expect, it } from "vitest";
import { routes as kitchen } from "../modules/kitchen/routes.ts";
import { routes } from "../modules/recipes/routes.ts";
import topology from "../topology.ts";

type Recipe = { id: string; title: string; minutes: number; favorite: boolean };
const JSON_HEADERS = { accept: "application/json", "content-type": "application/json", "x-keel": "1" };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** A fresh api deployable over its own sim ctx, a client sim ctx routed to it, and the requests the client sent. */
async function setup(seed = 1) {
  const api = await createApp({
    topology,
    routes: kitchen,
    ctx: createCtx({ mode: "sim", seed: 7 }),
    deployable: "api",
  });
  const call = (method: string, path: string, body?: unknown): Promise<Response> =>
    api.fetch(
      new Request(new URL(path, "http://localhost").href, {
        method,
        headers: JSON_HEADERS,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    );
  const recipes = async (): Promise<Recipe[]> => {
    const j: unknown = await (await call("GET", "/api/recipes")).json();
    const results = isRecord(j) && isRecord(j.results) ? j.results["kitchen.recipes"] : undefined;
    const value = isRecord(results) && isRecord(results.value) ? results.value.recipes : undefined;
    return Array.isArray(value) ? value.filter((r): r is Recipe => isRecord(r) && typeof r.id === "string") : [];
  };
  const ctx = createCtx({ mode: "sim", seed });
  const sent: string[] = [];
  ctx.net.route(new URL("/api/*", location.href).href, (req) => {
    sent.push(`${req.method} ${new URL(req.url).pathname}`);
    return api.fetch(req);
  });
  return { call, recipes, ctx, sent };
}

/** Seeds Soup (favorite) and Toast through the api; returns their ids. */
async function seeded(env: Awaited<ReturnType<typeof setup>>) {
  expect((await env.call("POST", "/api/recipes", { title: "Soup", minutes: 30 })).status).toBe(200);
  expect((await env.call("POST", "/api/recipes", { title: "Toast", minutes: 5 })).status).toBe(200);
  const all = await env.recipes();
  const soup = all.find((r) => r.title === "Soup")?.id ?? "";
  const toast = all.find((r) => r.title === "Toast")?.id ?? "";
  expect((await env.call("POST", `/api/recipes/${soup}/favorite`, {})).status).toBe(200);
  return { soup, toast };
}

const ids = (nodes: readonly A11yNode[], out: string[] = []): string[] => {
  for (const n of nodes) {
    out.push(n.id);
    ids(n.children, out);
  }
  return out;
};

describe("golden-2 acceptance", () => {
  it("index lists the api's recipes; the favorites filter keeps only favorites", async () => {
    const env = await setup();
    const { soup, toast } = await seeded(env);
    const all = await renderRoute("recipes.index", { routes, ctx: env.ctx });
    expect(all.find(`recipes.link.${soup}`).text).toBe("Soup");
    expect(all.find(`recipes.minutes.${toast}`).text).toBe("5 min");
    all.dispose();
    const favs = await renderRoute("recipes.index", { routes, search: { only: "favorites" }, ctx: env.ctx });
    const shown = ids(favs.a11y());
    expect(shown).toContain(`recipes.link.${soup}`);
    expect(shown).not.toContain(`recipes.link.${toast}`);
    favs.dispose();
  });

  it("the show page toggles favorite through its Form and revalidates", async () => {
    const env = await setup();
    const { toast } = await seeded(env);
    const r = await renderRoute("recipes.show", { routes, params: { recipeId: toast }, ctx: env.ctx });
    expect(r.find("recipes.title").text).toBe("Toast");
    expect(r.find("recipes.favorite").text).toBe("Not favorite");
    await r.fire("recipes.toggleFavorite", { type: "click" });
    await r.settle();
    expect(r.find("recipes.favorite").text).toBe("Favorite");
    expect((await env.recipes()).find((x) => x.id === toast)?.favorite).toBe(true);
    r.dispose();
  });

  it("an unknown recipe renders the errorElement", async () => {
    const env = await setup();
    const missing = createCtx({ mode: "sim", seed: 99 }).random.id("Recipe");
    const r = await renderRoute("recipes.show", { routes, params: { recipeId: missing }, ctx: env.ctx });
    expect(r.find("recipes.error").text.length).toBeGreaterThan(0);
    r.dispose();
  });

  it("a guest is redirected from recipes.new to recipes.index", async () => {
    const env = await setup();
    await env.ctx.storage.set("recipes.guest", "1");
    const r = await renderRoute("recipes.new", { routes, ctx: env.ctx });
    expect(r.route().id).toBe("recipes.index");
    r.dispose();
  });

  it("new recipe: invalid submit sends nothing; a duplicate title shows the api's field error; a valid one is listed", async () => {
    const env = await setup();
    await seeded(env);
    const r = await renderRoute("recipes.new", { routes, ctx: env.ctx });
    const before = env.sent.length;
    await r.fire("recipes.save", { type: "click" });
    expect(env.sent.slice(before).filter((x) => x.startsWith("POST"))).toEqual([]);
    expect(r.find("recipes.draft:title").state.focused).toBe(true);
    await r.fire("recipes.draft:title", { type: "input", value: "soup" });
    await r.fire("recipes.draft:minutes", { type: "input", value: "20" });
    await r.fire("recipes.save", { type: "click" });
    expect(env.sent).toContain("POST /api/recipes");
    expect(r.find("recipes.draft:title:error").text.length).toBeGreaterThan(0);
    await r.fire("recipes.draft:title", { type: "input", value: "Stew" });
    await r.fire("recipes.save", { type: "click" });
    await r.settle();
    expect(r.route().id).toBe("recipes.index");
    const stew = (await env.recipes()).find((x) => x.title === "Stew");
    expect(stew?.minutes).toBe(20);
    expect(r.find(`recipes.link.${stew?.id ?? ""}`).text).toBe("Stew");
    r.dispose();
  });
});
