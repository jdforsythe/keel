---
"@keel/compiler": minor
"@keel/runtime-dom": minor
"@keel/check": minor
---

`<script>` and `<style>` take literal text and attributes only: a data child, a bound or spread attribute, or literal text that would end the element early is E1002, and the lowering never binds into them. Literal text is written raw in HTML templates and set as text node data in SVG or MathML, escaped once by the serializer (backlog 0168) (rfc:0058, backlog 0157). `<meta http-equiv>` is E1003 in any form and is never rendered; `isRefusedAttr` refuses it, so `attr` and spreads drop it (backlog 0158). E1002 resolves names through the rfc:0053 resolver, which moves to `@keel/compiler/internal` and adds constant-string folding: aliases, destructuring, `globalThis`, folded keys and `execCommand('insertHTML')` are reported (backlog 0154). E1601 adds `Temporal.Now`, a no-date `Intl.DateTimeFormat` `format()`/`formatToParts()`, `performance.timeOrigin` and `navigator.sendBeacon`; E1603 adds a function's `constructor` and `import()` of a `data:` URL (backlog 0152).
