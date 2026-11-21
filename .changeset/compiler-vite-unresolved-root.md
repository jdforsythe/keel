---
"@keel/compiler": patch
---

The Vite plugin writes no `.keel/` artifact until `configResolved` gives it the root, so a plugin used without it writes nothing into the working directory.
