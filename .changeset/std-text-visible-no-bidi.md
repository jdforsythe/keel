---
"@keel/std-text": minor
---

`line` and `para` refuse a value with no visible character (only `White_Space` and `Default_Ignorable_Code_Point` characters, such as U+200B, U+3164 or U+FEFF) and a value with any `Bidi_Control` character, which adds U+061C, U+200E and U+200F to what was refused. A joiner between visible characters and a variation selector after one stay valid. Generated values satisfy the rule.
