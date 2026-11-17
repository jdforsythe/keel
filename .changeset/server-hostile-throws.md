---
"@keel/server": patch
---

No thrown value makes the server throw. A value whose `name`, `message`, `stack`, `toString` or `toJSON` throws, a Proxy or a revoked Proxy thrown by a loader, action, guard, live loader, component or runner is read inside a try and described by `Object.prototype.toString` or its `typeof` when a read throws; a runner that throws one runs again; `fetch` never rejects, and a throw past every guard of the handler is a bare 500 and one fixed `keel.unexpected` `diag`, with nothing of the value on stderr.
