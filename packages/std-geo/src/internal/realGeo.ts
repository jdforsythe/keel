import { ok } from "@keel/schema";
import type { Geolocator } from "../Geolocator.ts";
import { Position } from "../Position.ts";
import { unavailable } from "./unavailable.ts";

/** Real `geo`: one `navigator.geolocation.getCurrentPosition` per call; absence, denial or a bad reading is `err`. */
export function realGeo(): Geolocator {
  return {
    position: () =>
      new Promise((resolve) => {
        const g: Geolocation | undefined = typeof navigator === "undefined" ? undefined : navigator.geolocation;
        if (g === undefined) {
          resolve(unavailable("navigator.geolocation is absent"));
          return;
        }
        try {
          g.getCurrentPosition(
            (p) => {
              const r = Position.parse({
                lat: p.coords.latitude,
                lon: p.coords.longitude,
                accuracy: p.coords.accuracy,
              });
              resolve(r.ok ? ok(r.value) : unavailable("reading fails Position"));
            },
            (e) => resolve(unavailable(`geolocation failed: ${e.message}`)),
          );
        } catch (e) {
          resolve(unavailable(`geolocation threw: ${e instanceof Error ? e.message : String(e)}`));
        }
      }),
  };
}
