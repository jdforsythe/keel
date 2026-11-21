import type { Position } from "@keel/std-geo";
import type { MarketKey } from "./MarketKey.schema.ts";
import { distanceKm } from "./distanceKm.ts";
import { markets } from "./markets.ts";

/** The market closest to `position` and its distance in whole kilometers; the first listed wins a tie. */
export function nearestMarket(position: Position): { readonly key: MarketKey; readonly km: number } {
  let best: { key: MarketKey; km: number } = { key: "unionSquare", km: Number.POSITIVE_INFINITY };
  for (const m of markets) {
    const km = distanceKm(position, m);
    if (km < best.km) best = { key: m.key, km };
  }
  return { key: best.key, km: Math.round(best.km) };
}
