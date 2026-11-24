# Keel spec map

status key: proposed | implemented | conformance-covered | frozen.

## Code ranges
Kernel E1xxx, stdlib E2xxx, tooling E0xxx; review findings R1xxx (k.escapes); owner: keel docs --for <code>.
| block | owner | block | owner |
|-|-|-|-|
| E100x | k.compiler, k.boundary, k.bundle, k.head | E105x | k.cli, k.evidence, k.docs, k.review |
| E110x | k.schema, k.formats, k.privacy, k.reveal, k.leave, k.privacy-reads | E115x | k.module |
| E120x | k.reactive | E125x | k.runtime, k.resume, k.claim |
| E130x | k.store | E135x | k.scaffold, k.scaffold-shell, k.scaffold-service |
| E140x | k.component, k.place | E145x | k.errors |
| E150x | k.router, k.contract, k.guards, k.prefix, k.api | E155x | k.server, k.topology, k.deploy, k.shell, k.compat, k.hosting, k.security, k.origins, k.leave, k.user, k.mount |
| E160x | k.ctx, k.sim, k.persist, k.data | E165x | k.services |
| E170x | k.testing, k.model, k.prove, k.ledger | E175x | k.check, k.host |
| E18xx | k.ui, k.a11y, k.aria | E19xx | k.forms |
| E200x | std.sessions, std.multi, std.monitor | E210x | std.brands |
| E215x | std.db | E230x | std.i18n |
| E235x | std.workflows | E240x | std.messages |
| E250x | std.jobs | E255x | std.schedules |
| E260x | std.channels | E265x | std.offline |
| E270x | std.conflicts | E275x | std.statecharts |
| E280x | std.headless | E285x | std.tables |
| E220x | std.tokens | E245x | std.postgres, std.postgres-changes |

## Kernel
| id | section | status | one line |
|-|-|-|-|
| k.schema | Schemas | conformance-covered | codecs |
| k.formats | Format types | conformance-covered | brands |
| k.reactive | Reactivity | conformance-covered | signals |
| k.store | Store, transactions | conformance-covered | log |
| k.component | Components | conformance-covered | props |
| k.compiler | Compiler, artifacts | conformance-covered | JSX |
| k.boundary | Server boundary | conformance-covered | stubs |
| k.bundle | Browser bundles | implemented | workers |
| k.runtime | DOM runtime, islands | conformance-covered | nodes |
| k.resume | Documents, resume | conformance-covered | regions |
| k.claim | Claim order | conformance-covered | eager |
| k.defaults | Queued defaults | conformance-covered | submit |
| k.place | Placed props | conformance-covered | calls |
| k.router | Routes | conformance-covered | params |
| k.contract | Module contract | conformance-covered | entries |
| k.routes | Route table | conformance-covered | union |
| k.guards | Guards | implemented | deny |
| k.prefix | Path prefix | conformance-covered | enums |
| k.forms | Forms | conformance-covered | fields |
| k.ui | Tokens, styling | conformance-covered | CSS |
| k.ctx | Capabilities | implemented | clock |
| k.owner | Ctx owner | conformance-covered | dispose |
| k.errors | Results, boundaries | conformance-covered | Result |
| k.check | Checker, diagnostics | implemented | codes |
| k.check-cache | Type cache | implemented | reuse |
| k.explain | Explanations | conformance-covered | text |
| k.host | Host reads | conformance-covered | zone |
| k.cli | CLI, MCP, LSP | conformance-covered | flags |
| k.docs | Installed docs | conformance-covered | read |
| k.scaffold | Scaffold, codemods | implemented | edits |
| k.scaffold-shell | Shell scaffold | conformance-covered | shells |
| k.scaffold-service | Service scaffold | conformance-covered | clients |
| k.testing | Harness, properties | implemented | fire |
| k.test-run | Test end, results | implemented | dispose |
| k.requests | Requests sent | conformance-covered | sent |
| k.model | Store exploration | conformance-covered | traces |
| k.prove | Proving invariants | conformance-covered | Z3 |
| k.sim | Simulation | conformance-covered | faults |
| k.drive | Sim clock drive | implemented | idle |
| k.drive-law | Replays agree | implemented | replays |
| k.ledger | Ledger, evidence | implemented | rungs |
| k.server | Thin server | conformance-covered | loads |
| k.leave | What a request leaves | conformance-covered | state |
| k.user | User, caller | implemented | user |
| k.mount | Mount pages | conformance-covered | submit |
| k.mount-scope | Mount scope | conformance-covered | proxy |
| k.return | Shell mount | conformance-covered | net |
| k.opening | Openings | conformance-covered | once |
| k.links | Links in | conformance-covered | ids |
| k.serverlog | Server log | conformance-covered | bounds |
| k.sync | Concurrent writes | conformance-covered | heads |
| k.persist | Storage, durable state | conformance-covered | drivers |
| k.data | App data | conformance-covered | seam |
| k.topology | Deployables | conformance-covered | peers |
| k.deploy | Entry, deploy files | conformance-covered | entry |
| k.shell | Native shells | conformance-covered | target |
| k.compat | Surface compatibility | conformance-covered | accepts |
| k.api | API routes | conformance-covered | JSON |
| k.hosting | Client hosting | conformance-covered | servedBy |
| k.head | Document head | conformance-covered | title |
| k.services | Thin services | conformance-covered | clients |
| k.openapi | OpenAPI import | conformance-covered | clients |
| k.module | Module manifest | conformance-covered | surface |
| k.a11y | Accessibility | conformance-covered | WCAG |
| k.aria | Widget parts | conformance-covered | roles |
| k.roles | Part roles | conformance-covered | grid |
| k.host-element | Host elements | conformance-covered | charts |
| k.host-code | Host code | conformance-covered | d3 |
| k.security | Headers, CSP | conformance-covered | CSP |
| k.origins | Declared origins | conformance-covered | CSP |
| k.privacy | Secrets, personal data | conformance-covered | secrets |
| k.reveal | Revealed values | conformance-covered | E1112 |
| k.privacy-reads | Static privacy reads | conformance-covered | readers |
| k.evidence | Evidence bundle | conformance-covered | bundle |
| k.parity | Stdlib parity | proposed | seams |
| k.review | Review of escapes | conformance-covered | ranges |
| k.escapes | Escape codes | conformance-covered | R codes |

## Stdlib
Sections: `spec/std/README.md`.
