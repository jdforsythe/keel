import { attempt, ok } from "@keel/schema";
import type { Geolocator } from "../Geolocator.ts";
import { Position } from "../Position.schema.ts";
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
        const called = attempt(() =>
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
          ),
        );
        if (!called.ok) resolve(unavailable(`geolocation threw: ${called.error.data.cause}`));
      }),
  };
}
