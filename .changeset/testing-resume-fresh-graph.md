---
"@keel/testing": patch
---

`resumeDocument(html, { routes: () => import(path) })` resumes in a module graph of its own, so the test's module stores are neither read nor written.
