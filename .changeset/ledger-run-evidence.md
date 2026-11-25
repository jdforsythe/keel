---
"@keel/cli": minor
"@keel/check": minor
"@keel/testing": minor
---

k.ledger-items Run evidence and Projects: `keel ledger` reads each project's run reports (`<project>/reports/tests/*.json`), and a test gives evidence only while its project's report holds its file once, at the file's current `sha`, with a `passed` test and no `failed` one at a line of its call. A project whose test files no report holds fresh is one W1733 at `<project>/reports/tests/`, naming how many and the first; a project with a page route and no `reports/a11y.json` is W1733 at that path and its a11y items are `none` (`keptNoReport` is gone). A project is the ledger's folder and each `packages/<p>`, `apps/<a>` and `examples/<e>` holding a `package.json`: mutation reports and `mutation-justified.json` are read per project, and the ledger file's `mutation.packages` is `mutation.projects`, keyed by project name. `@keel/testing` exports `testRunReport`, the report `writeTestReport` writes; `keel pack`'s `ledger` step reads its `test` step's report, held and not written. `keel test` runs a project with a vitest config and no test file, which fails with T0001.
