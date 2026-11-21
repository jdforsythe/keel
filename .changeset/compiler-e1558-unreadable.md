---
"@keel/compiler": minor
---

`serverOnlyCalls` reads `loader` and `action` called through `import * as`, and a loader `fn` named by a top-level `const` generator. A call it cannot read (options not an object literal, or with a spread or computed key; a spread argument; a loader `fn` neither inline nor a top-level function or `const` of the file, an imported one included) is E1558, with `is not statically readable (write its options as an object literal and its fn in this file)`.
