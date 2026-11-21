// @vitest-environment node
// Server rendering in plain node (backlog 0156): no happy-dom, so createApp installs the DOM-free server tree and
// every compiled template of the real `recipes` pages renders on it. `recipes` is a client deployable in topology.ts;
// here it is served by the node adapter (a test topology) over a sim ctx whose net reaches the real `api` app.
import { createCtx } from "@keel/ctx";
import { createApp, topology } from "@keel/server";
import { describe, expect, it } from "vitest";
import { Box } from "../modules/kitchen/Box.schema.ts";
import { routes } from "../modules/recipes/routes.ts";
import { apiApp, apiCtx, asJson, draft } from "./simApi.ts";

const BASE = "http://localhost";

/**
 * The `recipes` pages as a node deployable whose loaders reach a fresh `api` deployable through `ctx.net`: with no
 * peers and no document, a `kitchen` module call goes to `http://kitchen.keel.invalid`.
 */
async function apps() {
  const api = await apiApp(apiCtx());
  const ctx = createCtx({ mode: "sim", seed: 1 });
  ctx.net.route("http://kitchen.keel.invalid/api/*", (req) => api.fetch(req));
  const web = await createApp({ topology: topology({ web: { modules: ["recipes"], adapter: "node" } }), routes, ctx });
  return { api, web };
}

const page = async (fetch: (r: Request) => Promise<Response>, path: string) => {
  const res = await fetch(new Request(`${BASE}${path}`, { headers: { accept: "text/html" } }));
  return { status: res.status, location: res.headers.get("location"), html: await res.text() };
};

/** The id the api minted for a recipe added through it. */
async function seed(api: { fetch: (r: Request) => Promise<Response> }, title: string): Promise<string> {
  expect((await api.fetch(asJson("POST", "/api/recipes", draft(title, 30)))).status).toBe(200);
  const body: unknown = await (await api.fetch(asJson("GET", "/api/recipes"))).json();
  const results = typeof body === "object" && body !== null && "results" in body ? body.results : null;
  const entry =
    typeof results === "object" && results !== null && "kitchen.box" in results ? results["kitchen.box"] : null;
  const box = typeof entry === "object" && entry !== null && "value" in entry ? Box.parse(entry.value) : null;
  return (box?.ok ? box.value.recipes.find((r) => r.title === title)?.id : undefined) ?? "";
}

describe("golden-2 documents in plain node (no DOM global)", () => {
  it("has no DOM global before createApp", () => {
    expect(typeof document).toBe("undefined");
  });

  it("renders every recipes GET route with its data, unprefixed for en-US", async () => {
    const { api, web } = await apps();
    const id = await seed(api, "Soup");
    expect(id).not.toBe("");
    const index = await page(web.fetch, "/");
    expect(index.status).toBe(200);
    expect(index.html).toContain(">Soup<");
    expect(index.html).toContain(">€12.50<");
    expect(index.html).toContain('<html lang="en-US">');
    expect(index.html).toContain("<title>Recipes · Keel</title>");
    const favorites = await page(web.fetch, "/?only=favorites");
    expect(favorites.status).toBe(200);
    expect(favorites.html).not.toContain(">Soup<");
    const show = await page(web.fetch, `/recipes/${id}`);
    expect(show.status).toBe(200);
    expect(show.html).toContain(">Soup<");
    expect(show.html).toContain("<title>Soup · Recipes</title>");
    const form = await page(web.fetch, "/recipes/new");
    expect(form.status).toBe(200);
    expect(form.html).toContain("<form");
    const missing = await page(web.fetch, "/recipes/nope");
    expect(missing.status).toBe(404);
    expect(missing.html).toContain("No recipe nope");
  });

  it("renders de-DE and ja-JP under their prefix, redirects a prefixed en-US URL and refuses other locales", async () => {
    const { api, web } = await apps();
    const id = await seed(api, "Soup");
    const de = await page(web.fetch, "/de-DE");
    expect(de.status).toBe(200);
    expect(de.html).toContain('<html lang="de-DE">');
    expect(de.html).toContain("<title>Rezepte · Keel</title>");
    expect(de.html).toContain(">12,50\u00A0€<");
    const ja = await page(web.fetch, `/ja-JP/recipes/${id}`);
    expect(ja.status).toBe(200);
    expect(ja.html).toContain('<html lang="ja-JP">');
    expect(ja.html).toContain("<title>Soup · レシピ</title>");
    expect(ja.html).toContain(">2026年11月10日に追加<");
    const prefixed = await page(web.fetch, `/en-US/recipes/${id}?x=1`);
    expect(prefixed.status).toBe(308);
    expect(prefixed.location).toBe(`/recipes/${id}?x=1`);
    expect((await page(web.fetch, "/fr-FR")).status).toBe(404);
  });

  it("answers the api deployable's GET route as JSON whatever accept says", async () => {
    const { api } = await apps();
    await seed(api, "Stew");
    const r = await page(api.fetch, "/api/recipes");
    expect(r.status).toBe(200);
    expect(r.html).not.toContain("<!doctype html>");
    expect(JSON.parse(r.html).id).toBe("kitchen.box");
  });
});
