---
"@keel/testing": minor
"@keel/check": minor
"@keel/scaffold": minor
---

`renderRoute(id, { routes, app, ctx })` with `app`, a `createApp` result, runs a `node` page as the build serves it: no router; the page is requested from `app` and resumed, a `<Form>` submit is POSTed urlencoded to `app`, a 303 is followed, and the answer (a 422 too) replaces the page before `fire` resolves. `state` or `shell` with `app` rejects with E1722. `keel check` warns W1723 on a literal `renderRoute` id of a `node` deployable's module with no `app`. `keel scaffold route` writes a node page's test with `app`.
