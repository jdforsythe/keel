import { attempt, err, ok } from "@keel/schema";
import type { Geolocator } from "../Geolocator.ts";
import { Position } from "../Position.schema.ts";
import { Unavailable } from "./Unavailable.schema.ts";

/** Real `geo`: one `navigator.geolocation.getCurrentPosition` per call; absence, denial or a bad reading is `err`. */
export function realGeo(): Geolocator {
  return {
    position: () =>
      new Promise((resolve) => {
        const g: Geolocation | undefined = typeof navigator === "undefined" ? undefined : navigator.geolocation;
        if (g === undefined) {
          resolve(err(Unavailable.make({}, "navigator.geolocation is absent")));
          return;
        }
        const called = attempt(
          () =>
            g.getCurrentPosition(
              (p) => {
                const r = Position.parse({
                  lat: p.coords.latitude,
                  lon: p.coords.longitude,
                  accuracy: p.coords.accuracy,
                });
                resolve(r.ok ? ok(r.value) : err(Unavailable.make({}, "reading fails Position")));
              },
              () => resolve(err(Unavailable.make({}, "geolocation failed"))),
            ),
          (x) => (x instanceof Error || typeof x === "string" ? Unavailable.make({}, "geolocation threw") : undefined),
        );
        if (!called.ok) resolve(called);
      }),
  };
}
