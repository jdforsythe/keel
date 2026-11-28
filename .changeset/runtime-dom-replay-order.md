---
"@keel/runtime-dom": patch
---

`resume` replays queued events once every island has resumed, in the order they fired, each through every enclosing island as a live one; a layout island that mismatches before its `children` call holds only the region the server's `<!--k-->` opens; a `#k-state` snapshot with no store in `stores` restores the store an island creates with its id while it resumes.
