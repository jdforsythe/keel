---
"@keel/compiler": patch
---

A server-rendered deployable's resume entry imports the atomic CSS under Vite, so a built `node` app's entry chunk names the stylesheet and every document's head links it.
