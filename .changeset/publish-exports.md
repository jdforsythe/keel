---
"@keel/check": patch
"@keel/cli": patch
"@keel/compiler": patch
"@keel/ctx": patch
"@keel/forms": patch
"@keel/reactive": patch
"@keel/router": patch
"@keel/runtime-dom": patch
"@keel/scaffold": patch
"@keel/schema": patch
"@keel/server": patch
"@keel/services": patch
"@keel/std-brands": patch
"@keel/std-capacitor": patch
"@keel/std-channels": patch
"@keel/std-conflicts": patch
"@keel/std-db": patch
"@keel/std-geo": patch
"@keel/std-headless": patch
"@keel/std-health": patch
"@keel/std-i18n": patch
"@keel/std-jobs": patch
"@keel/std-live": patch
"@keel/std-messages": patch
"@keel/std-money": patch
"@keel/std-offline": patch
"@keel/std-postgres": patch
"@keel/std-report": patch
"@keel/std-schedules": patch
"@keel/std-sessions": patch
"@keel/std-statecharts": patch
"@keel/std-tables": patch
"@keel/std-tauri": patch
"@keel/std-temporal": patch
"@keel/std-text": patch
"@keel/std-timings": patch
"@keel/std-tokens": patch
"@keel/std-workflows": patch
"@keel/store": patch
"@keel/testing": patch
"@keel/ui": patch
---

Every package carries `publishConfig.exports` at its built files, so a packed tarball resolves each export to a file it contains; `tooling/publish-exports.mjs` checks the mapping after a build.
