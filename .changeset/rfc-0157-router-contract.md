---
"@keel/router": minor
---

A module's routes are declared once in a contract: `contract(id, entries)` from `@keel/router/contract` (pages, layouts and API entries keyed by route id, `href` to its pages), bound by `manifest(contract, binding)`, whose binding is typed per id so each wrong member fails where it is written. `loader` and `action` name their entry and take their types from it. `routeTable(...tables)` is a deployable's union. A binding's `layout` names a layout of its own contract or of another module's, resolved where the tables are joined. A path pattern holds one page or one contract's API entries at distinct methods. Page components and `errorElement` are called `(props, ctx)`. `routes.actions`, `routes.href` and the entry-literal `manifest` are removed.
