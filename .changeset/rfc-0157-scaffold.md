---
"@keel/scaffold": minor
---

The generators write the module contract: a module gets `<id>.contract.ts` and a `routes.ts` binding, `route` adds a contract entry and its binding (`--api`, `--method`), handlers name their entry, components take `(props)` or `(props, ctx: Ctx)`, and the codemods keep the contract, binding, handler ids and `href` calls consistent.
