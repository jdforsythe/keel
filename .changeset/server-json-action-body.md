---
"@keel/server": patch
---

Actions accept a `content-type: application/json` body (what a `@keel/services` client sends), parsed with the action's input schema; failure is the same `keel.fields` 422 and the action does not run (tasks/0028-server D24).
