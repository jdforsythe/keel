---
"@keel/compiler": minor
"@keel/check": minor
"@keel/scaffold": minor
"@keel/server": patch
---

`@keel/compiler/client` is a types-only entry declaring `import.meta.env` (`BASE_URL`, `MODE`, `DEV`, `PROD`, `SSR`; any other key is a type error) and the default imports of `*?worker`, `*?sharedworker` and `*?url` (k.bundle Types). `keel check` loads it when it resolves from the project root, and a new project's `tsconfig.json` lists it in `types`. The server README states the scrubbed forms as k.privacy does.
