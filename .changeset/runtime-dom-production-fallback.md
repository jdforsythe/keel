---
"@keel/runtime-dom": minor
---

`mount` and `resume` take `mode: 'dev' | 'production'`, default `production`. In production the root fallback `<pre data-k-error>` holds `keel.unexpected`; with `mode: 'dev'` it holds the error's message. `onError` and the ctx's `error` report still get the full error. A caller that reads the fallback's text passes `mode: 'dev'` or reads `onError`.
