---
"@keel/server": patch
"@keel/store": patch
---

While `createApp` serves a request, through every `await`, a `tx` on a module-registry store throws E1256 and changes nothing; the level fails as a throw does and an action answers 500.
