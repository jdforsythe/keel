# ADR-0190: k.topology: the deployable key `host` becomes `servedBy` (RFC 0168)

**Status:** accepted (operator, D67 item 1).

**Context.** `host` on a `client` deployable names the `node` deployable that serves it. A host element is to take the word "host" in the API (rfc:0159), and nothing is released, so the key can change now.

**Decision.** The key is `servedBy`, with the same value and rules (E1566 keeps its code). A deployable's object is closed: any key but `modules`, `adapter`, `servedBy`, `storage`, `shells`, `caller` is E1552, in `topology()` and in the static read; `host` has no alias and no special message. Public derived names change with it (`Topology` and `DeployTopology` fields, the `hostProblems` subpath to `servedByProblems`, the client manifest key `keel:host` to `keel:servedBy`, messages, explanations, skills, READMEs, guides, apps); package-internal names (`hosted`, `hostClient`, `hostingDiags`) stay. Section ids and titles `k.host` and `k.hosting` stay.

**Alternatives.**
- An alias `host` that warns: a surface to remove later, and it cannot sit with a closed object.
- Keep the object open: an old `host` is ignored and the client is left unserved.
- `serves` on the node deployable: moves the one-client-per-node rule to the wrong side.

**Consequences.** One word, one meaning in the API. A mistyped deployable key is now E1552. The golden apps, guides and skill are rewritten by the build lane; no migration text exists.
