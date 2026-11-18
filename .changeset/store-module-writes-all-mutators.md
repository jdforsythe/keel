---
"@keel/store": patch
"@keel/server": patch
---

The module-write check covers every change to a module store: `tx`, `restore`, `undo` and `undoWhere` (not the start from a waiting `#k-state` snapshot). During a request `createApp` serves, each throws E1256 and changes nothing.
