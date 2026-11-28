---
"@keel/std-sessions": patch
---

A group's user workers load their modules from one SSR dev server per project config in the group's process, so each module is transformed once and each worker evaluates its own copy.
