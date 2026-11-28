---
"@keel/compiler": minor
"@keel/runtime-dom": minor
"@keel/ui": minor
---

Islands built from `@keel/ui` elements resume in place (backlog 0174; RFC 0064). `@keel/runtime-dom/ops` adds `element(tag, fill)`, which claims the next server element while resuming, and `slot(at, render)`, which hands a template slot's server element to the child component. Base elements build their nodes through `element` in document order. The compiler lowers template children to `slot` and marks component slots `<!--+-->`. A `Box`-rooted island, or a template with ui controls or compiled child components, no longer reports E1253. It keeps its server nodes and the focus, and a ui control edited before resume keeps the edit.
