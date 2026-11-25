---
"@keel/cli": minor
"@keel/check": patch
---

k.ledger-items Clause key and Citation: a spec clause's ledger item is `<section>#<key>`, the key the first 8 hex digits of the SHA-256 of its normal form, and its record holds its position `n`, which E1707 names. A conformance file cites one clause per header line, `// Spec: <section>, clause "<quote>"`; any other `// Spec:` line, an unknown section or a quote of no bullet is E1732, naming the nearest bullet, and two bullets of one section with one normal form are E1733. `pii.json` names each sink's clause by item. `keel explain` covers E1732, E1733 and W1733.
