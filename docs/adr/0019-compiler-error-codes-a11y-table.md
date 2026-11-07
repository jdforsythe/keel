# ADR-0019: Compiler failures have codes; one a11y table (RFC 0030)

**Status:** accepted
**Context.** Syntax errors at build-time evaluation surfaced as raw esbuild failures. `routes.ts` throws and internal failures had no code. E1501 fired on asset URLs. The compiler and `@keel/testing` derived roles and name sources from separate tables, so E1702 raised false alarms (testing PLAN D22).
**Decision.**
- E1000 replaces every other result for a file that does not parse, including at build-time evaluation.
- A `routes.ts` that throws or exports no `routes` is E1006. Coded throws keep their code. E1807 covers a `tokens.ts` that throws or exports no tokens.
- Internal failures are E1049, verbatim and without an app location. E1049 is the last code of k.compiler's block; E1099 would sit in k.cli's block.
- E1501 is limited to navigation attributes, for paths starting with `/` or matching a route pattern.
- `@keel/compiler/a11y` (`roleFor` and its tables) is the single role and name table. The harness imports it.
**Alternatives.** E1099 with a map exception. E1501 on every relative literal. Two role tables kept in sync by a test.
**Consequences.** Adding or fixing a role is one edit that both sides see. `compile()` throws only E1049. A broken `routes.ts` costs only its own routes. `keel check` needs explain entries for E1006 and E1049, which it cannot trigger. `@keel/ui` `Image src` still requires an `Href` until k.ui relaxes it.
