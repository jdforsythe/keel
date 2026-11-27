# security
| id | holds |
|-|-|
| k.security | response headers, content security policy, Trusted Types, reports, caller cookie |
| k.origins | declared third-party origins per deployable and their effect on the policy |
| k.privacy | `s.secret` and `.pii(class)` marks, sinks that redact, E1105 |
| k.reveal | what `reveal` returns, sinks it must not reach and flow rules, E1112 |
| k.privacy-reads | static readers of revealed values and schemas, factories and W1114 |
| std.tokens | opaque token mint and check, token forms, modes and extension points |
| k.review | `keel review` command, findings, danger, novelty and loudness |
| k.escapes | escape codes `keel review` reports, with danger and range codes |
| k.identity | kernel-held identity of made values, proven type predicates, E1762, E1764 |
| k.realm | one kernel copy per realm, the `keel.` symbol names, E1765, E1766 |
| k.unsafe | `unsafe(reason, fn)`, reason checks E1754 and E1760, negative type tests |
