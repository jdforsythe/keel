---
"@keel/cli": patch
---

Ledger evidence follows imports: a name a test binds through a relative import reaches only the export of the file the import resolves to, so a same-named export elsewhere gets no evidence from it; an import that resolves to a file only re-exporting the name (an `index.ts`), or to no known file, still reaches it by name.
