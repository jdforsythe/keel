# Keel spec map

status key: proposed | implemented | conformance-covered | frozen. Budget: this file <= 1,200 tokens; each section <= 1,500. Retrieve with `pnpm spec <id>`.

## Code ranges
Kernel E1xxx in blocks of 50; stdlib E2xxx; factory tooling E0xxx. `pnpm spec --for <code>` finds the owner.
| block | owner | block | owner |
| --- | --- | --- | --- |
| E100x | k.compiler | E105x | k.cli, k.evidence |
| E110x | k.schema, k.privacy | E115x | k.module |
| E120x | k.reactive | E125x | k.runtime |
| E130x | k.store | E135x | k.scaffold |
| E140x | k.component | E145x | k.errors |
| E150x | k.router, k.guards, k.prefix, k.api | E155x | k.server, k.topology, k.deploy, k.compat, k.hosting, k.security |
| E160x | k.ctx, k.sim | E165x | k.services |
| E170x | k.testing, k.model, k.ledger | E175x | k.check |
| E18xx | k.ui, k.a11y, k.aria | E19xx | k.forms |
| E200x | std.sessions, std.multi, std.monitor | E210x | std.brands |
| E230x | std.i18n | E240x | std.messages |
| E250x | std.jobs | E255x | std.schedules |
| E260x | std.channels | E265x | std.offline |
| E270x | std.conflicts | E275x | std.statecharts |
| E280x | std.headless | E285x | std.tables |

## Kernel
| id | section | status | one line |
| --- | --- | --- | --- |
| k.schema | Schemas | conformance-covered | declare once; types, validators, codecs, generators derive |
| k.reactive | Reactivity | conformance-covered | signal, computed, effect, resource, scopes |
| k.store | Store and transactions | conformance-covered | named pure transactions, log, undo, ownership |
| k.component | Components | conformance-covered | one default export, schema props, slot props, If/For/Match |
| k.compiler | Compiler and artifacts | conformance-covered | JSX to DOM ops; dep graph, ids, a11y |
| k.runtime | DOM runtime and islands | conformance-covered | fine-grained nodes, resume |
| k.router | Routes | conformance-covered | manifest, typed params and search, loaders, actions |
| k.guards | Guards | conformance-covered | guard, redirect with `next`, loop limit |
| k.prefix | Implied path prefix | conformance-covered | a leading enum param left out of the URL |
| k.forms | Forms | conformance-covered | form(schema): bindings, validation, submit, errors |
| k.ui | Tokens and styling | conformance-covered | typed style props, atomic CSS |
| k.ctx | Capabilities | conformance-covered | clock, random, net, storage; real, shell, sim |
| k.errors | Results and boundaries | conformance-covered | Result for expected, boundary for unexpected |
| k.check | Checker and diagnostics | conformance-covered | codes, fix diffs, budgets, rule registry |
| k.cli | CLI, MCP, LSP | conformance-covered | one engine, three surfaces, formatters |
| k.scaffold | Scaffold and codemods | conformance-covered | structural edits as operations |
| k.testing | Harness and properties | conformance-covered | given state, do events, expect; properties |
| k.model | Exploring a store's transactions | conformance-covered | reachable states, invariants |
| k.sim | Schedules and simulation | conformance-covered | delays, faults, offline windows; simulate |
| k.ledger | Ledger and evidence | conformance-covered | rungs, their producers, mutation claims |
| k.server | Thin server | conformance-covered | loaders, actions, dev server, adapters |
| k.sync | Heads and concurrent writes | conformance-covered | store heads, write bases, reject or rebase |
| k.topology | Deployables | implemented | placement, routes, runners, peers, `keel dev` |
| k.deploy | Production entry and deploy files | conformance-covered | `keel build`, `server.mjs`, deploy files |
| k.compat | Surface compatibility | conformance-covered | surface artifact, `accepts`, `--base` |
| k.api | API routes | conformance-covered | `api: true` entries: JSON, no view |
| k.hosting | Client hosting | implemented | static artifact, peer tag, origins, `host` |
| k.head | Document head | conformance-covered | per-route title, `<html lang>`, head links |
| k.services | Thin services | conformance-covered | typed client from schema, timeouts, ApiError |
| k.openapi | OpenAPI import | conformance-covered | OpenAPI 3 to endpoints and clients |
| k.module | Module manifest | conformance-covered | public surface; cross-module access checked |
| k.a11y | Accessibility | conformance-covered | props, contrast, focus order, claims |
| k.aria | Widget parts | conformance-covered | Part: roles, focus, dialog, styles |
| k.security | Headers and CSP | conformance-covered | headers, nonce CSP, Trusted Types, cookie |
| k.privacy | Secrets and personal data | conformance-covered | `s.secret`, `.pii(class)`, redacting sinks |
| k.evidence | Evidence bundle | conformance-covered | `keel evidence`: a signed bundle |

## Stdlib
Sections and statuses: `spec/std/README.md`.
