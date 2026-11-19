import type { MarketKey } from "./MarketKey.schema.ts";

/** Where each market is, in degrees: Union Square Greenmarket (New York), Viktualienmarkt (Munich), Tsukiji Outer Market (Tokyo). */
export const markets: readonly { readonly key: MarketKey; readonly lat: number; readonly lon: number }[] = [
  { key: "unionSquare", lat: 40.7359, lon: -73.9911 },
  { key: "viktualien", lat: 48.1351, lon: 11.5763 },
  { key: "tsukiji", lat: 35.6655, lon: 139.7707 },
];
