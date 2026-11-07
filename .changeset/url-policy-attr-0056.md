---
"@keel/runtime-dom": minor
"@keel/compiler": minor
---

URL policy covers `object data`, `srcset`/`imagesrcset` (every candidate), and the SVG animation values `to`/`from`/`by`/`values` (every `;` item) on any element; one bad item makes the attribute `about:blank` (rfc:0056, backlog 0132). `<base href>` is E1003 in any form and is never rendered. `attr` binds nothing for an `on*` name, so a JSX spread with an `onclick` key creates no inline handler (backlog 0133); `@keel/runtime-dom/url` exports `isRefusedAttr`. E1002 reports a literal `on*` string in a spread object literal.
