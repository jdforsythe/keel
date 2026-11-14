---
"@keel/router": minor
---

`navigate(href, { replace? })` is a public export: it navigates the router whose `App` encloses the caller, else the last one mounted, so a component callback can push or replace; with no router mounted it does nothing.
