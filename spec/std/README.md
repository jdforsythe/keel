# Stdlib spec

Sections are added per wave (see docs/ROADMAP.md). Each file: `std.<module>.md`, status line, API, Rules, Conformance, token budget 1,500 (`node tooling/budgets.mjs` measures them with the kernel sections).

Wave 0 proves one extension point per section: std.money (schema type registry), std.brands (check rule registry), std.geo (capability registry), std.health (module manifest), std.timings (inspector hooks), std.report (output formatter registry).

S2 adds std.i18n, std.temporal, std.text and std.messages and changes std.money.

S3 adds std.jobs and std.schedules.

S4 adds std.channels, std.live, std.offline, std.conflicts and std.multi.

## Sections
| id | section | status | one line |
| --- | --- | --- | --- |
| std.sessions | Sessions | conformance-covered | capture, ingest, replay, minimize, to-test; GitHub Action |
| std.i18n | Locales | conformance-covered | schema type registry and check rule registry: `i18n.Locale`, numbers, plurals |
| std.money | Money | conformance-covered | schema type registry: `money.Money`, add, format for a locale |
| std.temporal | Dates, instants and durations | conformance-covered | schema type registry: instants, dates, zones, durations; format |
| std.text | Text | conformance-covered | schema type registry: `text.Email`, `Slug`, `line`, `para`, collation |
| std.messages | Message sets | conformance-covered | check rule registry: message sets, one file per locale |
| std.brands | Id brand case | conformance-covered | check rule registry: E2101 with fix |
| std.geo | Geolocation | conformance-covered | capability registry: `geo`, seeded sim |
| std.health | Health route | conformance-covered | module manifest: route and public export via `deps` |
| std.timings | Timings | conformance-covered | inspector hooks: `timings.recent` section |
| std.report | Tally report | conformance-covered | formatter registry: `report.tally` |
| std.jobs | Background jobs | conformance-covered | module manifest and inspector hooks: durable jobs, retry, lease, E2501-E2504 |
| std.schedules | Schedules | conformance-covered | module manifest: cron in a zone, catch-up, E2551-E2553 |
| std.channels | Channels | proposed | module manifest and check rule registry: named channels over a server event stream, E2601-E2602 |
| std.live | Live views | proposed | composes std.channels: a client store re-read on every push |
| std.offline | Outbox | proposed | check rule registry: queued writes with keys and bases, resolve, E2651 |
| std.conflicts | Races | proposed | formatter registry: order-dependent rebased entries, E2701 |
| std.multi | Multi-user sessions | proposed | std-sessions: groups of users recorded and replayed under simulation, E2007-E2008 |
