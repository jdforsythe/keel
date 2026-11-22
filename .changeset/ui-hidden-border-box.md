---
"@keel/ui": patch
---

`w` and `h` rules are `box-sizing:border-box`, so a full-width control with padding and a border fits its container; the atomic CSS keeps `[hidden]` hidden over a flex prop.
