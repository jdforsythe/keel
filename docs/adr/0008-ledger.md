# ADR-0008: The verification ledger

**Status:** accepted
**Context.** Coverage numbers do not say what is known. Agents write tautological tests.
**Decision.** Every public function and spec clause reports its highest rung (proven, exhaustive, probabilistic, example, monitored) with evidence. Mutation score, not line coverage, is the test-quality signal. Claims lag machinery.
**Alternatives.** Coverage thresholds (gameable); no report (unverifiable).
**Consequences.** CI gates on ledger regression; marketing cites the ledger.
