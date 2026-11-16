---
"@keel/check": patch
---

E1563 and E1562 carry the make-it-optional fix for a field inside array items, record values or a nullable schema, not only at the top of the schema. `check(files)` without a `topology` option reports E1552 and E1566 for the root `topology.ts` from its static read, as `keel check` does.

A rule's `project` holds every code file of its project from `opts.project`, not only the files being checked; a checked file's own text wins.
