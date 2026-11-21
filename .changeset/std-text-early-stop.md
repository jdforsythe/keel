---
"@keel/std-text": patch
---

`line`, `para` and `truncate` stop segmenting at `max + 1` graphemes, so a very long input is rejected or cut without being read to the end.
