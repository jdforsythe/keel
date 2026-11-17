---
"@keel/cli": patch
---

`keel ledger` drops a mutation claim whose file is no longer in the tree, so a removed or moved file raises no W1714.
