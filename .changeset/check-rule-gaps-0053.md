---
"@keel/check": minor
"@keel/compiler": patch
---

rfc:0053 (backlog 0129): E1601 follows same-file aliases, parameter defaults, destructuring (`const { random } = Math`) and literal computed keys (template, `const` string), with names bound by lexical scope, and reports each use once at the use. New E1603 (k.ctx): `eval`, `Function(...)`, `new Function(...)` in app and test code. E1002 also reports `Reflect`/`Object` property calls with a literal `innerHTML`-family key, `el['innerHTML']`, `DOMParser`, `document.write`/`writeln`, `createContextualFragment`, `setHTMLUnsafe`, `srcdoc` members, and `setAttribute('srcdoc' | 'on*', ...)`.
