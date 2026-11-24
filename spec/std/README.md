# Stdlib spec

Sections are added per wave (see docs/ROADMAP.md). Each file: `std.<module>.md`, status line, API, Rules, Conformance, token budget 1,700 (`node tooling/budgets.mjs` measures them with the kernel sections).

Wave 0 proves one extension point per section: std.money (schema type registry), std.brands (check rule registry), std.geo (capability registry), std.health (module manifest), std.timings (inspector hooks), std.report (output formatter registry).

S2 adds std.i18n, std.temporal, std.text and std.messages and changes std.money.

S3 adds std.jobs and std.schedules.

S4 adds std.channels, std.live, std.offline, std.conflicts and std.multi.

S5 adds std.statecharts and std.monitor.

S7 adds std.headless, std.options and std.tables.

S8 adds std.db, std.workflows, std.shells and std.tokens.

## Sections
| id | section | status | one line |
| --- | --- | --- | --- |
| std.sessions | Sessions | conformance-covered | capture, ingest, replay, minimize, to-test; GitHub Action |
| std.i18n | Locales | proposed | schema type registry and check rule registry: `i18n.Locale`, numbers, plurals |
| std.money | Money | proposed | schema type registry: `money.Money`, add, format and parse for a locale |
| std.temporal | Dates, instants and durations | conformance-covered | schema type registry: instants, dates, zones, durations; format |
| std.text | Text | conformance-covered | schema type registry: `text.Email`, `Slug`, `line`, `para`, collation |
| std.messages | Message sets | proposed | check rule registry: message sets, one file per locale |
| std.copy | Literal copy | conformance-covered | `@keel/std-messages`: where E2406 reads copy and the shapes it follows |
| std.brands | Id brand case | conformance-covered | check rule registry: E2101 with fix |
| std.geo | Geolocation | conformance-covered | capability registry: `geo`, seeded sim |
| std.health | Health route | conformance-covered | module manifest: route and public export via `deps` |
| std.timings | Timings | conformance-covered | inspector hooks: `timings.recent` section |
| std.report | Tally report | conformance-covered | formatter registry: `report.tally`; `keel report` |
| std.jobs | Background jobs | conformance-covered | module manifest and inspector hooks: durable jobs, retry, lease, E2501-E2506 |
| std.schedules | Schedules | conformance-covered | module manifest: cron in a zone, catch-up, E2551-E2553 |
| std.channels | Channels | conformance-covered | module manifest and check rule registry: named channels over a server event stream, stores and followed app data, E2601-E2602 |
| std.live | Live views | conformance-covered | composes std.channels: a client store re-read on every push |
| std.offline | Outbox | conformance-covered | check rule registry: queued writes with keys and bases, resolve, E2651 |
| std.contracts | Stdlib contracts | proposed | std-health, std-sessions, std-channels and std-offline over k.contract |
| std.outbox | Outbox storage faults | conformance-covered | `@keel/std-offline`: storage writes that reject or never settle, other throws in a flush |
| std.outbox-owner | Outbox owner check | conformance-covered | `@keel/std-offline`: `writeFor` refuses a write of another owner than the caller's, `offline.owner` |
| std.conflicts | Races | conformance-covered | formatter registry: order-dependent rebased entries, E2701 |
| std.multi | Multi-user sessions | conformance-covered | std-sessions: groups of users recorded and replayed under simulation, E2007-E2008 |
| std.statecharts | State charts | conformance-covered | check rule registry: flat charts compiled to a store and transactions, E2751-E2755 |
| std.monitor | Production tallies | conformance-covered | std-sessions: server transaction counts as `monitored` evidence, E2009-E2010 |
| std.headless | Headless widgets | conformance-covered | Dialog, Disclosure, Toaster, three charts, E2801 |
| std.options | Listbox, combobox, menu and tabs | conformance-covered | Listbox, Combobox, Menu, Tabs on `optionsChart` |
| std.lists | List primitives | conformance-covered | `listChart`, `stableRows` for app components |
| std.tables | Data tables | conformance-covered | columns from a schema, query in the URL, `applyQuery`, E2851-E2853 |
| std.db | SQLite and Postgres storage | proposed | storage drivers (k.persist) and check rule registry: E2151-E2153 |
| std.postgres | Postgres app data | implemented | capability and check rule registries: `database`, `sql` with a result schema, `serializable` transactions, `changed` and `follow`, migrations, PGlite under sim, E2451-E2460 |
| std.workflows | Workflows | conformance-covered | module manifest, inspector hook, check rule registry: chart instances over jobs, E2351-E2355 |
| std.shells | Shell drivers | implemented | storage and net drivers for Capacitor and Tauri shells |
| std.capacitor | Capacitor shell target | implemented | shell target: Android and iOS files, tools, build, CI jobs |
| std.tauri | Tauri shell target | implemented | shell target: desktop files, tools, build, CI job |
| std.tokens | Opaque tokens | conformance-covered | capability, schema type and check rule registries: `mint` with a ttl, `check`, `idOf`, `Digested`, E2201-E2203 |
