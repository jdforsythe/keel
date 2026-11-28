---
"@keel/testing": minor
"@keel/cli": minor
---

k.test-run Run report: `writeTestReport(root, files, shard?)` writes a finished vitest run's report to `reports/tests/run.json`, or `<i>-of-<k>.json` for a shard: per test file its source's SHA-256 and each test's location line and state. `keel test` writes it for the project with vitest's `includeTaskLocation` set.
