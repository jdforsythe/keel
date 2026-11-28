---
"@keel/ui": minor
"@keel/compiler": minor
"@keel/check": minor
"@keel/std-tables": minor
---

`Box scroll="x"` renders a named, keyboard-reachable scroll region (E1802 without exactly one of `label` and `labelledBy`); `textAlign` (`start`, `center`, `end`) is a style prop; `keel.base` gains `th{text-align:inherit}` and `.k-scroll{overflow-x:auto;min-width:0}`; `DataTable` takes `scroll="x"` and `styles` keys `column.<col>`, with E2851 for a key naming no shown column.
