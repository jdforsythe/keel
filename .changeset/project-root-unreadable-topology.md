---
"@keel/compiler": patch
"@keel/check": patch
---

A folder that holds a `topology.ts` with a default export is a project root whether or not the file reads statically. An unreadable one is E1552 at its path, and the folder's files are checked and built as that project's, not the root's.
