---
"@keel/check": minor
"@keel/cli": minor
"@keel/compiler": minor
"@keel/scaffold": minor
"@keel/server": minor
---

Keel writes every document. A `client` deployable's `index.html` is generated in dev as in a build; a project's own `index.html` is never read, and `keel check`, `keel dev` and `keel build` each print one W1012 naming it. A deployable's `styles` lists package `.css` exports (`styles: ['@keel/ui/fonts']`): its entry imports each, so a server document's head and a client's `index.html` link them. Under `keel dev` every document links `/@keel/styles.css?d=<name>`, the deployable's `styles` and the atomic CSS, so a page is styled before any script runs, as a built one is. An entry that is not a string literal or not a package `.css` export is E1587 in `keel check` and `keel build`. `keel scaffold project` writes no `index.html` and gives its deployable `styles: ['@keel/ui/fonts']`; `keel codemod place` gives a deployable it creates the same.
