---
"@keel/compiler": patch
---

The client entry binds `service({ contract })` targets only for the `node` deployables' modules the client's browser code imports (and placed stdlib modules), so the names of other server modules are not in the browser build; `docs/THREAT-MODEL.md` states it.
