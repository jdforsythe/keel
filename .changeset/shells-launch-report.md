---
"@keel/std-capacitor": minor
"@keel/std-tauri": minor
---

The shell reports its launch to the router once its launch read settles (`getLaunchUrl`, `getCurrent`): its links, none, or a failed read, and listens for running links after that report. Links are sorted by path: a page or a declared mount path is taken at any time, any other mount path only against a pending opening.
