---
"@keel/router": patch
"@keel/testing": patch
---

`renderRoute` rejects with `keel.unexpected` and the thrown message (a `tx` in a component body: E1201) when a page's render throws and no `errorElement` catches it, instead of resolving on the router's bare alert.
