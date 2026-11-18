# Keel spec map

status key: proposed | implemented | conformance-covered | frozen. Budget: this file <= 1,200 tokens; a section <= 1,500.

## Code ranges
Kernel E1xxx in blocks of 50, stdlib E2xxx, tooling E0xxx; `pnpm spec --for <code>` finds the owner.
| block | owner | block | owner |
| --- | --- | --- | --- |
| E100x | k.compiler | E105x | k.cli, k.evidence |
| E110x | k.schema, k.privacy, k.reveal | E115x | k.module |
| E120x | k.reactive | E125x | k.runtime, k.resume |
| E130x | k.store | E135x | k.scaffold |
| E140x | k.component | E145x | k.errors |
| E150x | k.router, k.guards, k.prefix, k.api | E155x | k.server, k.topology, k.deploy, k.shell, k.compat, k.hosting, k.security |
| E160x | k.ctx, k.sim, k.persist | E165x | k.services |
| E170x | k.testing, k.model, k.prove, k.ledger | E175x | k.check |
| E18xx | k.ui, k.a11y, k.aria | E19xx | k.forms |
| E200x | std.sessions, std.multi, std.monitor | E210x | std.brands |
| E215x | std.db | E230x | std.i18n |
| E235x | std.workflows | E240x | std.messages |
| E250x | std.jobs | E255x | std.schedules |
| E260x | std.channels | E265x | std.offline |
| E270x | std.conflicts | E275x | std.statecharts |
| E280x | std.headless | E285x | std.tables |
| E220x | std.credentials | | |

## Kernel
| id | section | status | one line |
| --- | --- | --- | --- |
| k.schema | Schemas | conformance-covered | types, validators, codecs, generators |
| k.reactive | Reactivity | conformance-covered | signals, effects, resources, scopes |
| k.store | Store and transactions | conformance-covered | transactions, log, undo, ownership |
| k.component | Components | conformance-covered | schema and slot props, If/For/Match |
| k.compiler | Compiler and artifacts | conformance-covered | JSX to DOM ops, ids, a11y |
| k.runtime | DOM runtime and islands | conformance-covered | fine-grained nodes, resume |
| k.resume | Served documents and resume | implemented | regions, layout islands |
| k.router | Routes | conformance-covered | params, search, loaders, actions |
| k.guards | Guards | conformance-covered | redirects with `next`, loop limit |
| k.prefix | Implied path prefix | conformance-covered | a leading enum param URLs omit |
| k.forms | Forms | conformance-covered | bindings, validation, errors |
| k.ui | Tokens and styling | conformance-covered | typed style props, atomic CSS |
| k.ctx | Capabilities | conformance-covered | clock, random, net, storage |
| k.errors | Results and boundaries | conformance-covered | Result or boundary |
| k.check | Checker and diagnostics | conformance-covered | codes, fixes, budgets, rules |
| k.cli | CLI, MCP, LSP | conformance-covered | one engine |
| k.scaffold | Scaffold and codemods | conformance-covered | structural edits |
| k.testing | Harness and properties | conformance-covered | given, do, expect |
| k.model | Exploring a store's transactions | conformance-covered | states, invariants |
| k.prove | Proving invariants | conformance-covered | Z3 proofs |
| k.sim | Schedules and simulation | conformance-covered | delays, faults, offline |
| k.ledger | Ledger and evidence | conformance-covered | rungs, producers, mutation |
| k.server | Thin server | conformance-covered | loaders, actions, server state |
| k.serverlog | Server log records | conformance-covered | bounds, cut marks |
| k.sync | Heads and concurrent writes | conformance-covered | heads, bases, reject or rebase |
| k.persist | Storage and durable state | conformance-covered | storage, drivers |
| k.topology | Deployables | conformance-covered | placement, runners, peers |
| k.deploy | Production entry and deploy files | conformance-covered | `server.mjs`, `storage` |
| k.shell | Native shells | proposed | Capacitor and Tauri apps |
| k.compat | Surface compatibility | conformance-covered | surface, `accepts`, `--base` |
| k.api | API routes | conformance-covered | JSON, no view |
| k.hosting | Client hosting | implemented | static artifact, origins, `host` |
| k.head | Document head | conformance-covered | title, `lang`, links |
| k.services | Thin services | conformance-covered | typed clients, ApiError |
| k.openapi | OpenAPI import | conformance-covered | OpenAPI 3 to clients |
| k.module | Module manifest | conformance-covered | public surface, cross-module checks |
| k.a11y | Accessibility | conformance-covered | contrast, focus order |
| k.aria | Widget parts | conformance-covered | roles, focus, dialog, styles |
| k.security | Headers and CSP | conformance-covered | nonce CSP, cookie |
| k.privacy | Secrets and personal data | conformance-covered | `s.secret`, `.pii(class)`, sinks |
| k.reveal | Revealed values | conformance-covered | E1112 |
| k.evidence | Evidence bundle | conformance-covered | a signed bundle |

## Stdlib
Sections: `spec/std/README.md`.
