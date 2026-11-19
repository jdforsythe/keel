---
"@keel/server": patch
---

The server DOM accepts listeners on every node (backlog 0128, red-team M4). `addEventListener` and `removeEventListener` move from the server element to the server node, so the server `document` takes them too, and drops them: the server fires no events. Importing `@keel/runtime-dom/ops` or `@keel/ui` after `createApp` installs the server DOM no longer throws `document.addEventListener is not a function`; import order no longer matters.
