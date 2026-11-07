# ADR-0024: Fix set by reason, real-binary budget, stdlib parity (RFC 0035)

**Status:** accepted
**Context.** k.check asked fix diffs for "the top 30 codes", an undefined set; 5 were asserted. The 600-token budget was asserted over `format()`, and the inspect endpoint and stdlib rules partly (backlog 0060, freeze review §1).
**Decision.** The spec names the fix set: 16 check-reportable codes carry a one-hunk fix (E1151, E1155, E1157 are new); every other fixtured code is listed in RFC 0035 with the reason none is correct. Any fix any diagnostic carries must `git apply` and clear its code. No fix edits a file under `node_modules/`. The budget clause is asserted by running the `keel` binary on golden-1 plus `tooling/fixtures/injected10-app`, as `tooling/budgets.mjs` does. Inspect is asserted from `@keel/cli` conformance against `@keel/server` `createApp` (cli is after server in `tooling/deps.json`). A stdlib manifest sits at the package root with a lowerCamel `id` as its prefix.
**Alternatives.** Placeholder fixes (E1754 justification, E1802 label) to reach 30: they apply and mislead. Proxy budget over `format()`: not the real command (D1).
**Consequences.** A new fix needs an RFC row; a code that later gains one moves from the no-fix list. The injected-10 run has ~50 tokens of headroom, so a fix for any of its ten codes (E1403 first) must shrink the compact rendering first.
