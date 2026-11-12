---
"@keel/testing": minor
"@keel/check": patch
---

`resumeDocument(html, { routes, ctx?, artifacts? })` resumes a server document's islands with the route components through `resume` and resolves with the `render` handle; a resume warning rejects with E1720, which `keel explain` describes.
