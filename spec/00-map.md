# Keel spec map

status key: proposed | implemented | conformance-covered | frozen. Budget: this file <= 1,200 tokens; each section <= 1,500. Retrieve with `pnpm spec <id>`.

## Code ranges
Kernel E1xxx in blocks of 50; stdlib E2xxx; factory tooling E0xxx. `pnpm spec --for <code>` finds the owner.
| block | owner | block | owner |
| --- | --- | --- | --- |
| E100x | k.compiler | E105x | k.cli |
| E110x | k.schema | E115x | k.module |
| E120x | k.reactive | E125x | k.runtime |
| E130x | k.store | E135x | k.scaffold |
| E140x | k.component | E145x | k.errors |
| E150x | k.router | E155x | k.server |
| E160x | k.ctx | E165x | k.services |
| E170x | k.testing | E175x | k.check |
| E18xx | k.ui | E19xx | k.forms |
| E200x | std.sessions | E210x | std.brands |

## Kernel
| id | section | status | one line |
| --- | --- | --- | --- |
| k.schema | Schemas | conformance-covered | declare once; types, validators, codecs, generators derive |
| k.reactive | Reactivity | conformance-covered | signal, computed, effect, resource; scopes dispose |
| k.store | Store and transactions | conformance-covered | named pure transactions, log, undo, ownership |
| k.component | Components | conformance-covered | one default export, schema props, named slots, If/For/Match |
| k.compiler | Compiler and artifacts | conformance-covered | JSX to DOM ops; dep graph, ID index, route table, a11y expectations |
| k.runtime | DOM runtime and islands | conformance-covered | fine-grained nodes, delegation, resume |
| k.router | Routes | conformance-covered | manifest, typed params and search, loaders, actions by verb, guards |
| k.forms | Forms | conformance-covered | form(schema): bindings, validation, submit, server errors |
| k.ui | Tokens and styling | conformance-covered | typed style props, atomic CSS, scoped, a11y-required props |
| k.ctx | Capabilities | conformance-covered | clock, random, net, storage; real, shell, simulated; observers |
| k.errors | Results and boundaries | conformance-covered | Result for expected, boundary for unexpected |
| k.check | Checker and diagnostics | conformance-covered | codes, fix diffs, budgets, rule registry |
| k.cli | CLI, MCP, LSP | conformance-covered | one engine, three surfaces, formatter registry |
| k.scaffold | Scaffold and codemods | conformance-covered | structural edits as operations |
| k.testing | Harness and ledger | conformance-covered | given state, do events, expect; rungs |
| k.server | Thin server | conformance-covered | loaders, actions, dev server, adapters, local topology |
| k.services | Thin services | conformance-covered | typed client from schema, timeouts, ApiError |
| k.module | Module manifest | conformance-covered | declared public surface; cross-module access checked |

## Stdlib
See `spec/std/README.md`. Sections are added per wave with their own budgets.
| id | section | status | one line |
| --- | --- | --- | --- |
| std.sessions | Sessions | implemented | capture, ingest, replay, minimize, to-test; GitHub Action |
| std.money | Money | conformance-covered | schema type registry: `money.Money`, add, format |
| std.brands | Id brand case | conformance-covered | check rule registry: E2101 with fix |
| std.geo | Geolocation | conformance-covered | capability registry: `geo`, seeded sim |
| std.health | Health route | conformance-covered | module manifest: route and public export via `deps` |
| std.timings | Timings | conformance-covered | inspector hooks: `timings.recent` section |
| std.report | Tally report | conformance-covered | formatter registry: `report.tally` |
