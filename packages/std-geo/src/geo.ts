import { type Ctx, register } from "@keel/ctx";
import type { Geolocator } from "./Geolocator.ts";
import { realGeo } from "./internal/realGeo.ts";
import { simGeo } from "./internal/simGeo.ts";

/**
 * The `geo` capability accessor (std.geo, k.ctx registry): `geo(ctx).position()`. Real reads the browser's
 * geolocation; shell delegates to real until native adapters exist; sim is one seeded position per ctx.
 */
export const geo: (ctx: Ctx) => Geolocator = register<Geolocator>("geo.position", {
  real: () => realGeo(),
  shell: () => realGeo(),
  sim: ({ seed }) => simGeo(seed),
});
