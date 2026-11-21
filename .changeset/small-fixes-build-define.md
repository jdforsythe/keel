---
"@keel/compiler": patch
---

A build defines `import.meta.env.DEV` as `false` and `import.meta.env.PROD` as `true`, so a `vite.config.ts` that sets `process.env.NODE_ENV` no longer gives app code `DEV === true` under `keel build`.
