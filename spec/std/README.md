# Stdlib spec

Sections are added per wave (see docs/ROADMAP.md). Each file: `std.<module>.md`, status line, API, Rules, Conformance, token budget 1,500 (`node tooling/budgets.mjs` measures them with the kernel sections).

Wave 0 (RFC 0047) proves one extension point per section: std.money (schema type registry), std.brands (check rule registry), std.geo (capability registry), std.health (module manifest), std.timings (inspector hooks), std.report (output formatter registry).

S2 (RFC 0079) adds std.i18n, std.temporal, std.text and std.messages and changes std.money.

S3 (RFC 0080) adds std.jobs and std.schedules.

| id | section | status | one line |
| --- | --- | --- | --- |
| std.jobs | Background jobs | proposed | module manifest and inspector hooks: durable jobs, retry, lease, E2501-E2504 |
| std.schedules | Schedules | proposed | module manifest: cron in a zone, catch-up, E2551-E2553 |
