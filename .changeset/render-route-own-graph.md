---
"@keel/testing": minor
"@keel/ctx": patch
---

`renderRoute(id, { routes: () => import(path), app })` resumes the page in a client module graph of its own, so two harnesses of one page over one `app` and `ctx` each resume and keep their own client stores and widget state. An import without `app` is E1722. A ctx's observers and meta are shared by every `@keel/ctx` copy in the realm, so a page in such a graph hears the ctx's `net` changes and builds its capabilities.
