# std.timings: Timings
status: conformance-covered

**Extension point.** Inspector hooks (k.cli, RFC 0042). Importing `@keel/std-timings` registers the inspect section `timings.recent`. A dev app's `GET /__keel/inspect` serves it in `sections`, and `keel inspect` prints it as an `inspect.section` record.

**API** (`@keel/std-timings`).
```ts
import { time } from '@keel/std-timings'
const rows = await time(ctx, 'orders.load', () => db.rows())
```
- `time(ctx, name, fn)` reads `ctx.clock.now()`, awaits `fn()`, and reads it again. It records the difference under `name` for that ctx, also when `fn` rejects. It returns or rethrows `fn`'s outcome unchanged.
- `Timings` is `s.record(s.object({ count: s.int({ min: 1 }), totalMs: s.number({ min: 0 }), maxMs: s.number({ min: 0 }), lastMs: s.number({ min: 0 }) }, { closed: true }))`. It is keyed by name.
- `timingsOf(ctx)` returns the `Timings` of that ctx: per name, the call count, the summed, largest and latest durations. Each ctx has its own record. A ctx with no calls gives `{}`.
- The section is `inspector({ id: 'timings.recent', schema: Timings, read: timingsOf })`.

**Rules.** None. A second registration of `timings.recent` is E1057 (k.cli).

**Conformance.**
- Under a sim ctx, `time` around a `fn` that advances the clock by `d` records `lastMs` `d`. For generated duration lists of one name, `count`, `totalMs` and `maxMs` are the list's length, sum and maximum.
- `time` returns `fn`'s value. When `fn` rejects, `time` rejects with the same reason, and the call is still counted.
- Two ctxs keep separate timings; a fresh ctx gives `{}`.
- A dev `createApp` whose app ctx ran `time` serves `sections['timings.recent']` as `{ doc: Timings.doc(), value: Timings.encode(timingsOf(ctx)) }`.
- Registering another inspector with id `timings.recent` throws E1057.
