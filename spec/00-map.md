# Keel spec map

status key: proposed | implemented | conformance-covered | frozen. Budget: this file <= 1,200 tokens; each section <= 1,500. Retrieve with `pnpm spec <id>`.

## Kernel
| id | section | status | one line |
| --- | --- | --- | --- |
| k.schema | Schemas | proposed | declare once; types, validators, codecs, generators derive |
| k.reactive | Reactivity | proposed | signal, computed, effect, resource; scopes dispose |
| k.store | Store and transactions | proposed | named pure transactions, log, undo, ownership |
| k.component | Components | proposed | one default export, schema props, named slots, If/For/Match |
| k.compiler | Compiler and artifacts | proposed | JSX to DOM ops; dep graph, ID index, route table, a11y expectations |
| k.runtime | DOM runtime and islands | proposed | fine-grained nodes, delegation, resume |
| k.router | Routes | proposed | manifest, typed params and search, loaders, actions by verb, guards |
| k.forms | Forms | proposed | form(schema): bindings, validation, submit, server errors |
| k.ui | Tokens and styling | proposed | typed style props, atomic CSS, scoped, a11y-required props |
| k.ctx | Capabilities | proposed | clock, random, net, storage; real, shell, simulated |
| k.errors | Results and boundaries | proposed | Result for expected, boundary for unexpected |
| k.check | Checker and diagnostics | proposed | codes, fix diffs, budgets, rule registry |
| k.cli | CLI, MCP, LSP | proposed | one engine, three surfaces, formatter registry |
| k.scaffold | Scaffold and codemods | proposed | structural edits as operations |
| k.testing | Harness and ledger | proposed | given state, do events, expect; rungs |
| k.server | Thin server | proposed | loaders, actions, dev server, adapters, local topology |
| k.services | Thin services | proposed | typed client from schema, timeouts, ApiError |
| k.module | Module manifest | proposed | declared public surface; cross-module access checked |

## Stdlib
See `spec/std/README.md`. Sections are added per wave with their own budgets.
