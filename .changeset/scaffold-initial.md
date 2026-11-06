---
"@keel/scaffold": minor
---

k.scaffold: pure `scaffold(op, input, files)` and `plan` (dry run) over a project tree. Generators `project` (package.json, tsconfig, tokens.ts, topology.ts, vite.config.ts, module app, generated turbo.json and CI, .keel/), `module` (manifest, routes.ts, topology entry, turbo regenerated from the module set), `route` (manifest entry, `*.server.ts` loader, page component, route test), `component` (`<Name>.tsx` with `Props` schema, property test), `store` (state schema, store, invariant test). AST-aware codemods `rename` (component, store, route, schema), `move` (imports both ways, both manifests), `add-field` (schema shape plus every store initial, form `initial`, and typed fixture). Refusals E1351-E1354, E1005; nothing written on refusal.
