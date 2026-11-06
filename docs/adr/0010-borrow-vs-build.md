# ADR-0010: Borrow mature runtimes behind the spec

**Status:** accepted
**Context.** Scope is five frameworks' worth. The product is the spec, conformance, and loop.
**Decision.** Borrow reactivity engine, validator, parser, bundler, HTTP server, test runner, browser automation. Build compiler artifacts, store and log, check/cli/mcp/lsp, sessions.
**Alternatives.** Build everything (schedule); wrap a whole framework (inherits its footguns).
**Consequences.** Conformance suite is what makes implementations swappable; a compat layer with its own tests is a permanent budget line.
