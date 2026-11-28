# Keel spec map

`pnpm spec <area>` lists an area's sections with status (proposed, implemented, conformance-covered, frozen) and contents; `pnpm spec <id>` prints a section. `--for` finds sections by code (`E1042`), code block (`E155x`), API name (`renderRoute`) or glossary term (`"identity mount"`). Codes: kernel E1xxx, stdlib E2xxx, tooling E0xxx, review R1xxx.

| area | holds |
|-|-|
| values | Schemas, formats, value types, locales and message sets |
| state | Reactivity, stores, transactions, capabilities and state charts |
| client | Components, the compiler, bundles, served documents and forms |
| routes | Routes, the module contract, guards and API routes |
| ui | Styling, widgets, host elements and accessibility |
| server | The thin server, users, the identity mount, services and jobs |
| deploy | Deployables, deploy files, client hosting and native shells |
| data | Durable storage, concurrent writes and app data |
| live | Channels, live views, the outbox and races |
| tools | The checker, explanations, the CLI, installed docs and scaffold |
| testing | The harness, exploration, proofs, simulation and end-to-end tests |
| evidence | The ledger, evidence bundles, sessions and production tallies |
| security | Headers, origins, secrets, personal data, escapes and unsafe |
| libraries | Module manifests, libraries, publishing and grants |
