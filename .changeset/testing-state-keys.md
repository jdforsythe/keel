---
"@keel/testing": minor
---

Harness state gains `active` (the id `aria-activedescendant` names) and `sort` (the `aria-sort` value), and `checked` is `'mixed'` for a mixed checkbox. `fire`'s `keydown` also takes `shift`, `alt` and `mod`, each false when absent, so a test can press Alt+ArrowDown or a Ctrl chord.
