# RFC 0117: std.temporal: `TimeZone` names from a pinned IANA list, kept as written

Status: accepted (orchestrator under the owner's standing leave, 2026-11-17). For backlog 0321. ADR-0139 records it.

## Problem
std.temporal defines `TimeZone` as `UTC` or an IANA name that `Intl.DateTimeFormat` accepts and "reports back unchanged in `resolvedOptions().timeZone`". The second half depends on the host's canonicalisation, which differs:
- V8 (Node 24.19, ICU 78.3) reports `Asia/Kolkata` as `Asia/Calcutta` and `Europe/Kyiv` as `Europe/Kiev`, so the current names fail `parse` on Node and in Chrome. Firefox and Safari report the name as given (case-normalised), so there `Asia/Kolkata` passes and a value written in one browser fails to parse in another or on the server.
- `gen` maps a drawn integer into `Intl.supportedValuesOf('timeZone')`, whose length and order follow the host's ICU (418 names on Node 24). One seed gives different zones on different hosts and ICU versions, so a seeded property run does not repeat.

## Proposal
**Rule.** A `TimeZone` is `UTC` or a Zone or Link name of the IANA tz database release the package pins, spelled exactly as in that release, that `Intl.DateTimeFormat` accepts as `timeZone`. The value is kept as written: `parse` does not canonicalise, `encode` is the identity, `formatInstant` and `plainDateOf` pass it to `Intl` as given. Case is not folded: `asia/kolkata` and `utc` are rejected, so each value has one text. Both a zone and its links are valid (`Asia/Kolkata` and `Asia/Calcutta`), as distinct values; every name V8 reports today is on the list, so no value that parsed on Node before is refused. The `Intl` check stays so a name newer than the host's ICU fails `parse` instead of throwing later in `formatInstant`.

**`gen`.** Draws from the pinned release's Zone names (with `UTC`), by index into the package's own list, so one seed gives the same values on every host.

**The list.** `packages/std-temporal/src/internal/zoneNames.ts`, a generated constant: the Zone (`Z`) and Link (`L`, the link's own name) lines of the release's `tzdata.zi`, less `Factory`, sorted, with the Zone names marked for `gen`; its first line names the release (for example `2026a`). Measured on the 2026 data here: 345 Zone and 253 Link names, 598 in all; packed by area (`America:New_York,…;Asia:Kolkata,…`) it is about 3.0 KB gzip. It is refreshed when IANA publishes a release that adds, removes or renames a name: the lane regenerates the file from that release's `tzdata.zi`, the same derivation, and ships it with a changeset. No tooling gate checks it against the host.

## Alternatives
- Accept any name `Intl` accepts, kept as written, without a list: `utc`, `america/new_york` and `Asia/Kolkata` would all be valid texts, several per zone, and `gen` would still follow the host.
- Canonicalise in `parse` to the host's name: not a format type (encode would not be the identity), and the host's answer differs.
- `Intl.supportedValuesOf` only: V8's list lacks `Asia/Kolkata`, the problem itself.
- Zone names only, no links: values written on Node today (`Asia/Calcutta`) would fail `parse`.

## Choices
- C1: the name must equal the IANA spelling exactly (case-sensitive), so one text per value; `utc` stays rejected.
- C2: Link names are valid with Zone names; `gen` draws from Zone names only (and `UTC`).
- C3: the list ships in the client entry, because `parse` needs it: `@keel/std-temporal` grows by about 3 KB gzip, and its budget is re-based once by the lane on the measured size.
- C4: the list is refreshed by regenerating one file from a named tzdb release; no generator joins `tooling/` and no gate checks freshness.

## Spec diff
std.temporal, the `TimeZone` bullet, whole new text:
```
- `TimeZone` is `UTC` or a Zone or Link name of the package's pinned IANA tz database release, spelled as there, that `Intl.DateTimeFormat` accepts as `timeZone`, kept as written (`Asia/Kolkata`, `Asia/Calcutta`; not `utc`); `gen` draws from its Zone names. `UTC` is exported as a `TimeZone`.
```
To stay within 6,000 characters, five neighbouring passages tighten, meaning unchanged (no conformance header quotes them):
- Extension point: "one canonical text per value" (was "one canonical ISO 8601 text per value"; a zone name is not ISO 8601).
- `PlainDate`: "- `PlainDate` is `YYYY-MM-DD`, a proleptic Gregorian date in years 0001 to 9999; string order is date order."
- `instantOf`: "…; a non-finite value, or one outside years 0001 to 9999, is `temporal.outOfRange` with `value` `ms`. No export reads the clock. `epochMs(i: Instant): number` is its inverse." (the example above the list shows `instantOf(ctx.clock.now())`).
- `plainDateOf`: "…; when that date would leave years 0001 to 9999, it is `i`'s UTC date."
- `durationOf`: "… for an integer within the bounds (any other `ms` throws); …"; `formatDuration` drops its last sentence on `Intl.DurationFormat`.

Conformance, appended as the last bullet:
```
- `TimeZone.parse` accepts `Asia/Kolkata`, `Asia/Calcutta` and `Europe/Kyiv` and rejects `asia/kolkata`; one seed gives equal `gen` values on every host.
```
Section length 5,964 to 5,998 characters (1,491 to 1,500 tokens).

## Conformance diff
One `rfc:0117` commit by the `conformance-writer`:
- New `packages/std-temporal/conformance/timezone-names.test.ts`, citing the new bullet: `TimeZone.parse` of `Asia/Kolkata`, `Asia/Calcutta` and `Europe/Kyiv` is `ok` with the value unchanged; `asia/kolkata` is rejected with rule `format`. Host independence of `gen`: under seed 1337, 50 `gen(TimeZone)` values drawn as usual equal 50 drawn with `Intl.supportedValuesOf` stubbed (`vi.spyOn`) to return `["Mars/Olympus"]`.
- No existing file changes: `parse-rejects.test.ts:26` (`Mars/Olympus`, `utc`) still holds; `gen-roundtrip.test.ts:27-29`, `format-date-instant.test.ts:34` and `host-independent.test.ts:84` draw from `gen(TimeZone)`, whose values all parse on Node 24.

## Migration
None for stored data written on Node: every name V8 reported is on the list. A value written in Firefox or Safari as a current name (`Asia/Kolkata`) now parses on Node. A value in a non-IANA case (none can exist: such a value failed `parse` before) stays refused. `packages/std-temporal/README.md` states the rule and the list, and drops the `ISO 8601` wording for zones.

## Build order
1. Orchestrator: `spec/std/std.temporal.md` (done with this RFC). The `conformance-writer`: the new file above.
2. One std-temporal lane owns `packages/std-temporal/src/TimeZone.ts`, the new `packages/std-temporal/src/internal/zoneNames.ts`, `packages/std-temporal/test/**`, `packages/std-temporal/README.md`, `tooling/budgets.json` (the `@keel/std-temporal` line only, re-based once on the measured size), and a changeset (`@keel/std-temporal` minor: current names accepted, `gen` changes). It runs `check`, `build`, the std-temporal and std-schedules suites once (std.schedules reads `zone` as a `TimeZone`) and `pnpm budgets`.
3. Orchestrator: ledger, backlog 0321 closed, HANDOFF.

## Token impact
std.temporal 1,491 to 1,500 tokens (5,964 to 5,998 characters). No other section changes.
