# ADR-0216: four behaviours the spec states: E1720 names its cause, `run()` waits for `ctx.net`, the listener is named, dev reloads through a helper (RFC 0194)

**Status:** accepted (orchestrator).

**Context.** Four fixes made the framework do what k.testing, k.sim, std.postgres and k.data did not say.

**Decision.** E1720 carries the thrown text of a claim's throw. A `ctx.net` route that has not answered is work in flight: `simulate`'s `run()` waits for it, and with nothing else moving the run's clock steps. The listening connection's `application_name` is `keel-listen-<pid>`. Under `keel dev`, editing an app file that registered a capability, itself or through a helper, or editing that helper, loads the server graph again whole; a capability id two files register is still E1602.

**Alternatives.** The cause in production too (the text can carry data); a caller-side await (the scenario cannot await a request it did not start); a random listener name; a reload on every app file edit.

**Consequences.** Four clauses join the ledger at `none` until the conformance-writer covers them.
