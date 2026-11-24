---
"@keel/check": minor
---

W1608 warns at every `import()` expression in app code: a module load is I/O no ctx owns, so a `simulate` run neither waits for it nor orders it by seed (k.ctx). Not reported: an `import()` that is E1603, a `Host`'s `code` in E1824's form, and a message set's `load` given to `messages` from `@keel/std-messages`; test code is not judged and a lifted range of an `unsafe/` file does not report it. It is a warning, so it never fails `keel check`.
