# ADR-0193: k.privacy-reads: the checker's privacy readers for stdlib rules, and three rules on them (RFC 0170)

**Status:** proposed (for the orchestrator to accept).

**Context.** A revealed value given to a job queue is stored in plain text, a password control can bind a plain `s.string()` field, and a token digest can be sent in an `output`; no rule reports any of them. The stdlib rules that would cannot reach E1111's and E1112's readers, which `@keel/check` keeps internal.

**Decision.** `@keel/check` exports `carriesReveal`, `schemaHolds` and `outputSchemas`, stated in a new kernel section k.privacy-reads. std.jobs gains E2506 (a revealed value given to `enqueue`), std.tokens E2203 (`Digested` in a loader or API `output`), k.privacy-reads W1114 (a password control over a field that is not `s.secret`). Each reports only where its reader reads a yes, and the spec states what each does not see. std.jobs and std.tokens read `implemented` until their new clauses are covered.

**Alternatives.** `enqueue` as an E1112 sink (a kernel rule naming a stdlib API); a copied walk per package (drift); E2203 at run time (a new schema flag for one type); W1114 as a render check (only for rendered pages) or a type error (refuses computed paths); W1114 as an error (fails existing apps under the freeze).

**Consequences.** Three new codes, two of them errors for projects using std-jobs or std-tokens; the golden apps are clean. Library rules can use the same readers. No run-time behaviour changes.
