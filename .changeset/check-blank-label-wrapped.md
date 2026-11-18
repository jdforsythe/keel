---
"@keel/check": patch
---

E1802 reads a blank literal `label` through parentheses, `as`, `satisfies` and `!`, and inside an object literal spread into the JSX element or the call's object.

A literal `label` is blank for E1802 when it has no visible character: every character is White_Space, Default_Ignorable_Code_Point, `Cf`, `M` or U+2800, read after JSX numeric character references are decoded, so `label={"​"}` and `label="&#x2800;"` are reported.

A control character (`Cc`) is not visible either, and a JSX named character reference such as `&copy;` or `&zwnj;` does not count as a visible character, so `label="&copy;"` and `Input({ label: "\u{1}" })` are E1802 and `label="&copy;2"` is not.
