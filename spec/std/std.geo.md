# std.geo: Geolocation
status: conformance-covered

**Extension point.** Capability registry (k.ctx `register`). `@keel/std-geo` registers capability `geo.position` (k.data E1607: `<id>.<name>`) with real, shell and sim implementations and exports its accessor `geo`. Modules that use it list `geo.position` in `capabilities` (k.module).

**API** (`@keel/std-geo`).
```ts
import { geo } from '@keel/std-geo'
const r = await geo(ctx).position()   // Result<Position, KeelError<'geo.unavailable', {}>>
```
- `Position` is `s.object({ lat: s.number({ min: -90, max: 90 }), lon: s.number({ min: -180, max: 180 }), accuracy: s.number({ min: 0 }) }, { closed: true })`; `accuracy` is in meters.
- `Geolocator` is `{ position(): Promise<Result<Position, KeelError<'geo.unavailable', {}>>> }`.
- **real.** Reads `navigator.geolocation.getCurrentPosition` once per call. A missing `navigator.geolocation`, a denied or failed request, or a reading that fails `Position` gives `err` `geo.unavailable`.
- **shell.** Delegates to real until native adapters exist (k.ctx convention).
- **sim.** One fixed position per capability seed (k.ctx derives it from the ctx seed and `geo.position`): a seeded generator draws `lat` in [-90, 90], `lon` in [-180, 180) and `accuracy` in [1, 100). Every call on that ctx returns `ok` with the same value. It reads no clock, network or device.

**Rules.** None. `geo.unavailable` is a KeelError code (k.errors).

**Conformance.**
- `capabilities()` lists `geo.position`, and `geo(ctx)` returns an object with a `position` function under real, shell and sim; the three are distinct objects.
- Under sim, for generated seeds, two ctxs with the same seed give equal positions, and the position parses with `Position`.
- Under sim, repeated calls on one ctx give equal positions; across generated distinct seeds, the positions are not all equal.
- Under real where `navigator.geolocation` is absent, `position()` resolves `err` with code `geo.unavailable` and does not throw; shell does the same.
- `geo(ctx)` called twice on one ctx returns the same object (k.ctx lazy resolution).
