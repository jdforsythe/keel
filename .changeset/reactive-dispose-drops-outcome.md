---
"@keel/reactive": patch
---

Disposing a computed drops its value and its error, so a handle held after `dispose` keeps neither reachable.
