# @keel/std-geo

**Spec:** std.geo · **Status:** conformance-covered · **verified:** (none)

## Contract

- **Public API:** `geo(ctx).position(): Promise<Result<Position, KeelError<'geo.unavailable'>>>`, `Position` (closed `{ lat, lon, accuracy }`), type `Geolocator`.
- **Invariants:** real reads `navigator.geolocation` once per call and never throws (absent, denied or invalid is `geo.unavailable`); shell delegates to real; sim is one fixed position per capability seed (mulberry32), no clock, net or device.
- **Dependencies:** `@keel/ctx`, `@keel/schema`.
- **Rungs:** conformance (example + probabilistic), property for the sim generator.

## Extension points

Uses the **capability registry** (k.ctx `register('geo', { real, shell, sim })`).

## Unsafe

count: 0
