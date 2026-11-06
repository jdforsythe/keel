# PRD C: The stdlib (stub)

One section per wave; each becomes a full PRD when its gate opens. Order follows ROADMAP.md S1-S8.

- **S1 Sessions.** Capture ring buffer, redaction from PII tags, ingest handler, archive adapters, fingerprinting, `keel session fetch|replay|minimize|to-test`, GitHub Action, policy gates.
- **S2 Values.** `money(currency)` integer minor units, rounding per field, allocation; `decimal`; Temporal types; grapheme text; i18n with typed message keys and Intl.
- **S3 Server depth.** Jobs with retries and idempotency, schedules, streams, split topology with generated clients, Docker/CI/compose generation, `check --compat`.
- **S4 Realtime.** Live resources, channels, presence, SSE/WebSocket transport, offline queue, per-field conflict strategies, remote transactions in the log.
- **S5 Correctness.** Statecharts and model checking, deterministic simulator with fault injection, mutation score in ledger, coordinated session replay.
- **S6 Compliance.** A11y pack, CSP with nonces, Trusted Types, CSRF, cookie defaults, PII redaction in logs and telemetry, consent primitive, evidence bundle.
- **S7 UI modules.** Headless dialog, menu, combobox, tabs, toast, command palette; tables with sort, filter, paginate, virtualize.
- **S8 Reach.** DB with generated migrations and row policies, durable workflows, Capacitor and Tauri targets, verification track (SMT for the decidable transaction subset).
