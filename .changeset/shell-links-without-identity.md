---
"@keel/compiler": patch
"@keel/std-tauri": patch
"@keel/std-capacitor": patch
---

A shell build delivers page links with or without an `identity.ts`: the generated entry always calls `shellMount` with the shell's `id`, and `mount` is optional in `@keel/std-tauri` and `@keel/std-capacitor`; without it every link that is not a page link is ignored.
