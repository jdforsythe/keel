---
"@keel/check": minor
"@keel/router": patch
---

A binding's `layout` may name a layout of another module when either module lists the other in `deps`: the page's module lists the layout's, or the layout's module, which composes the page, lists the page's. `keel check` reports E1152 at `layout` only when neither does; a `layout` adds no `deps` edge, so E1153 sees none. `routesArtifact` gives a module's bindings when a `layout` names another module's layout; serving that module's table alone is still E1506.
