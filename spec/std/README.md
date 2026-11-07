# Stdlib spec

Sections are added per wave (see docs/ROADMAP.md). Each file: `std.<module>.md`, status line, API, Rules, Conformance, token budget 1,500 (`node tooling/budgets.mjs` measures them with the kernel sections).

Wave 0 (RFC 0047) proves one extension point per section: std.money (schema type registry), std.brands (check rule registry), std.geo (capability registry), std.health (module manifest), std.timings (inspector hooks), std.report (output formatter registry).
