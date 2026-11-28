---
"@keel/runtime-dom": patch
---

Content nodes and island Props schemas are typed through unsafe/; a handler's returned thenable is caught through Promise.resolve.
