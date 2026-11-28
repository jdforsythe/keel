---
"@keel/std-sessions": patch
---

E2005 reads `createRequire(...)(S)`, `module.require(S)`, a parenthesized or aliased `require`, and an `import()` or `require()` whose argument is a `+` of literals or a `const` bound to one. A specifier it cannot resolve is still not read.
