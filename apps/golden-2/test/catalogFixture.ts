import { createCtx } from "@keel/ctx";
import { Box } from "../modules/kitchen/Box.schema.ts";
import { apiApp, apiCtx, asJson, draft } from "./simApi.ts";

/** One day in ms: each seeded recipe is dated a day after the one before. */
const DAY = 86_400_000;

/** The twelve recipes the catalog tests seed, over three currencies; every third is a favorite. */
export const CATALOG: readonly {
  title: string;
  minutes: number;
  amount: number;
  currency: string;
  favorite: boolean;
}[] = [
  { title: "Apple pie", minutes: 75, amount: 1200, currency: "EUR", favorite: true },
  { title: "Borscht", minutes: 90, amount: 900, currency: "USD", favorite: false },
  { title: "Curry udon", minutes: 25, amount: 1100, currency: "JPY", favorite: false },
  { title: "Dal", minutes: 40, amount: 700, currency: "EUR", favorite: true },
  { title: "Empanadas", minutes: 60, amount: 1500, currency: "USD", favorite: false },
  { title: "Focaccia", minutes: 120, amount: 600, currency: "JPY", favorite: false },
  { title: "Gazpacho", minutes: 20, amount: 800, currency: "EUR", favorite: true },
  { title: "Hummus", minutes: 15, amount: 500, currency: "USD", favorite: false },
  { title: "Irish stew", minutes: 150, amount: 1400, currency: "JPY", favorite: false },
  { title: "Jambalaya", minutes: 55, amount: 1300, currency: "EUR", favorite: true },
  { title: "Kimchi", minutes: 45, amount: 400, currency: "USD", favorite: false },
  { title: "Lasagne", minutes: 95, amount: 1000, currency: "JPY", favorite: false },
];

/**
 * A client sim ctx whose net sends `/api/*` to a fresh `api` deployable seeded with `CATALOG` (a day apart, from
 * 2026-11-10), and `ids`, each title's minted id. `sent` records `METHOD /path?query` of each request.
 */
export async function catalogApi(seed = 1) {
  const server = apiCtx();
  const app = await apiApp(server);
  for (const r of CATALOG) {
    await app.fetch(asJson("POST", "/api/recipes", draft(r.title, r.minutes, r.amount, r.currency)));
    server.clock.advance(DAY);
  }
  const body: unknown = await (await app.fetch(asJson("GET", "/api/recipes"))).json();
  const results = typeof body === "object" && body !== null && "results" in body ? body.results : null;
  const entry =
    typeof results === "object" && results !== null && "kitchen.recipes" in results ? results["kitchen.recipes"] : null;
  const box = typeof entry === "object" && entry !== null && "value" in entry ? Box.parse(entry.value) : null;
  const recipes = box?.ok ? box.value.recipes : [];
  const ids = new Map<string, string>(recipes.map((r) => [r.title, r.id]));
  for (const r of CATALOG)
    if (r.favorite) await app.fetch(asJson("POST", `/api/recipes/${ids.get(r.title) ?? ""}/favorite`, {}));
  const ctx = createCtx({ mode: "sim", seed });
  const sent: string[] = [];
  ctx.net.route(new URL("/api/*", location.href).href, (req) => {
    const url = new URL(req.url);
    sent.push(`${req.method} ${url.pathname}${url.search}`);
    return app.fetch(req);
  });
  /** The id minted for `title`. */
  const id = (title: string): string => ids.get(title) ?? "";
  return { ctx, sent, app, id };
}
