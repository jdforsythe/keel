# ADR-0139: `TimeZone` names come from a pinned IANA list and are kept as written (RFC 0117)

**Status:** accepted (orchestrator under the owner's standing leave, 2026-11-17).

**Context.** `TimeZone` required a name that `Intl.DateTimeFormat` reports back unchanged. V8 reports `Asia/Kolkata` as `Asia/Calcutta`, so current names failed on Node while Firefox and Safari accepted them; `gen` indexed into `Intl.supportedValuesOf`, so one seed gave different zones on different hosts.

**Decision.**
- D1: a `TimeZone` is `UTC` or a Zone or Link name of the package's pinned IANA tz database release, spelled exactly as there (case-sensitive), that `Intl.DateTimeFormat` accepts; it is kept as written.
- D2: `gen` draws from that release's Zone names, so seeded runs repeat on every host.
- D3: the list lives in `packages/std-temporal/src/internal/zoneNames.ts`, generated from the release's `tzdata.zi` and refreshed with a changeset when IANA adds, removes or renames a name.

**Alternatives.**
- Any name `Intl` accepts, no list: several texts per zone, and `gen` still follows the host.
- Canonicalising in `parse`: not a format type, and hosts disagree.
- Zone names only: values written on Node (`Asia/Calcutta`) would fail.

**Consequences.**
- One value text per name on every host; Node accepts current names.
- `@keel/std-temporal` carries the list, about 3 KB gzip, in its client entry.
