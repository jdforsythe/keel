---
"@keel/router": minor
"@keel/forms": minor
"@keel/scaffold": minor
"@keel/server": patch
"@keel/cli": patch
"@keel/check": patch
"@keel/reactive": patch
---

RFC 0045: `<Form method action form? error?>` takes `action` as an `Href` (`routes.href(id, params)`); the `params` prop and the global newest-manifest map are removed; inside a router an action whose matched route lacks the method is E1505. `compileRoutes`, `compileTable`, `matchUrl`, `needsBare`, `parseSearch`, `runGuard`, `fieldsError`, `formHandle` and the types `Level`, `Located`, `Match`, `Segment`, `Table` move to `@keel/router/internal`. The `<Form form>` seam (`setPending`, `validate`, `onResult`) is keyed by `formHandle`; `FormState` keeps `field`, `values`, `errors`, `pending`, `reset`. `@keel/scaffold` drops `plan` (`scaffold` is pure; `--dry-run` skips the writes). E1205 (read of a disposed computed) is back in the k.reactive Rules with a conformance clause and a `keel explain` row.
