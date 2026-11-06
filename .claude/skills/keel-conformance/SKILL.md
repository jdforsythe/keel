---
name: keel-conformance
description: Write conformance tests from a spec section without seeing the implementation.
---
# Conformance writing

Input: one spec section id. You may read only `spec/`, `docs/GLOSSARY.md`, and `packages/<pkg>/index.ts` types.

For each sentence under **Conformance** and each rule code under **Rules**: one test, named with the clause text, importing the public API only. Use `@keel/testing` harness and schema generators. Properties over examples where a space is infinite. Record the seed. Tests go to `packages/<pkg>/conformance/<clause>.test.ts`.

Output a list of test names and the clauses they cover. If a clause is untestable, say so in one line; do not invent behavior.
