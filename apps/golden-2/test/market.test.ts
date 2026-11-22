import { createCtx } from "@keel/ctx";
import { geo } from "@keel/std-geo";
import { render, renderRoute } from "@keel/testing";
import { afterEach, describe, expect, it } from "vitest";
import { MarketKey } from "../modules/recipes/MarketKey.schema.ts";
import NearestMarket from "../modules/recipes/NearestMarket.tsx";
import { RecipesText } from "../modules/recipes/RecipesText.schema.ts";
import { distanceKm } from "../modules/recipes/distanceKm.ts";
import { markets } from "../modules/recipes/markets.ts";
import { nearestMarket } from "../modules/recipes/nearestMarket.ts";
import { routes } from "../modules/recipes/routes.ts";
import { artifacts } from "./artifacts.ts";
import { catalogApi } from "./catalogFixture.ts";

const live: { dispose(): void }[] = [];
afterEach(() => {
  for (const h of live.splice(0)) h.dispose();
});

/** The catalog page's shopping list tab in `locale`, over a sim ctx of `seed`: its geo position is that seed's. */
async function listTab(locale: "en-US" | "de-DE" | "ja-JP", seed: number) {
  const api = await catalogApi(seed);
  const r = await renderRoute("recipes.catalog", { routes, params: { locale }, ctx: api.ctx, artifacts });
  live.push(r);
  await r.fire("recipes.views.tab.list", { type: "click" });
  return { api, r };
}

describe("the nearest market on the shopping list", () => {
  it("names the market closest to the device and its distance, and sends the position nowhere", async () => {
    const { api, r } = await listTab("en-US", 1);
    expect(r.find("recipes.market.find").name).toBe("Find the nearest market");
    expect(r.find("recipes.market.nearest")).toMatchObject({ role: "status", text: "" });
    const sent = api.sent.length;
    await r.fire("recipes.market.find", { type: "click" });
    expect(r.find("recipes.market.nearest").text).toBe(
      "Nearest market: Union Square Greenmarket, New York, 903 km away",
    );
    expect(() => r.find("recipes.market.unavailable")).toThrow();
    expect(api.sent.length).toBe(sent);
  });
  it("names it in de-DE and ja-JP with the locale's digits", async () => {
    const de = await listTab("de-DE", 12);
    await de.r.fire("recipes.market.find", { type: "click" });
    expect(de.r.find("recipes.market.nearest").text).toBe(
      "Nächster Markt: Viktualienmarkt, München, 2.777 km entfernt",
    );
    de.r.dispose();
    const ja = await listTab("ja-JP", 3);
    await ja.r.fire("recipes.market.find", { type: "click" });
    expect(ja.r.find("recipes.market.nearest").text).toBe("最寄りの市場: 築地場外市場（東京）（約 6,444 km）");
  });
  it("agrees with the position the ctx's geo capability reports", async () => {
    const { api, r } = await listTab("en-US", 9);
    const at = await geo(api.ctx).position();
    expect(at.ok && nearestMarket(at.value)).toEqual({ key: "viktualien", km: 3309 });
    await r.fire("recipes.market.find", { type: "click" });
    expect(r.find("recipes.market.nearest").text).toBe("Nearest market: Viktualienmarkt, Munich, 3,309 km away");
  });
  it("says the location is not available on a device that has no geolocation", async () => {
    const stop = new AbortController();
    const ctx = createCtx({ mode: "real", signal: stop.signal });
    const t = render(NearestMarket, {
      props: { params: { locale: "en-US" }, text: await RecipesText.load("en-US") },
      ctx,
    });
    live.push(t);
    await t.fire("recipes.market.find", { type: "click" });
    expect(t.find("recipes.market.unavailable").text).toBe(
      "Your location is not available. Allow location access in the browser, then press the button again.",
    );
    expect(t.find("recipes.market.nearest").text).toBe("");
    stop.abort();
  });
});

describe("market distances", () => {
  it("is 0 km at each market, which is then the nearest", () => {
    for (const m of markets)
      expect(nearestMarket({ lat: m.lat, lon: m.lon, accuracy: 5 })).toEqual({ key: m.key, km: 0 });
  });
  it("measures the great circle: a quarter of the equator, pole to pole, and New York to Tokyo", () => {
    expect(Math.round(distanceKm({ lat: 0, lon: 0 }, { lat: 0, lon: 90 }))).toBe(10008);
    expect(Math.round(distanceKm({ lat: 90, lon: 0 }, { lat: -90, lon: 0 }))).toBe(20015);
    const [newYork, , tokyo] = markets;
    expect(newYork !== undefined && tokyo !== undefined && Math.round(distanceKm(newYork, tokyo))).toBe(10846);
  });
});

describe("market keys", () => {
  it("MarketKey takes each listed market's key, once each, and nothing else", () => {
    const keys = markets.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(MarketKey.parse(key)).toEqual({ ok: true, value: key });
    for (const other of ["", "UnionSquare", "unionsquare", " tsukiji", "borough", 0, null, undefined, ["tsukiji"]])
      expect(MarketKey.parse(other).ok).toBe(false);
  });
  it("names a listed market for the position of every sim seed from 1 to 100", async () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 100; seed++) {
      const at = await geo(createCtx({ mode: "sim", seed })).position();
      expect(at.ok).toBe(true);
      if (!at.ok) continue;
      const key = MarketKey.parse(nearestMarket(at.value).key);
      expect(key.ok).toBe(true);
      if (key.ok) seen.add(key.value);
    }
    expect([...seen].sort()).toEqual(markets.map((m) => m.key).sort());
  });
});
