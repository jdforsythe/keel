---
name: keel-review
description: Review a PR against principles, spec, ledger, budgets, and unsafe count.
---
# Review checklist

Answer each in one line; cite principle numbers.
1. Which spec section and clause does this implement? Is status updated correctly?
2. Any second way to do an existing thing? (P1)
3. Any action at a distance, hidden ordering, or implicit behavior? (P2, P8)
4. Conformance untouched or RFC-tagged?
5. Properties present; mutation score; ledger delta.
6. Output contract respected; budgets measured.
7. `unsafe` count delta and justifications.
8. Docs, README contract, changeset.
Verdict: approve / request changes with the smallest fix.
