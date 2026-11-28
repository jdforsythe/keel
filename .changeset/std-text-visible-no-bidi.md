---
"@keel/std-text": minor
---

`line` and `para` refuse a value with no visible character (only `White_Space` and `Default_Ignorable_Code_Point` characters, such as U+200B, U+3164 or U+FEFF) and a value with any `Bidi_Control` character, which adds U+061C, U+200E and U+200F to what was refused. A joiner between visible characters and a variation selector after one stay valid. The visible character must also lie outside the general categories `Cf` and `M` and U+2800 (so U+2800, U+FFF9 to U+FFFB, U+13430 and a value of combining marks alone are refused), and a lone surrogate is refused. Generated values satisfy the rule.
