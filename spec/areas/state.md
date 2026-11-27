# state
| id | holds |
|-|-|
| k.reactive | `signal`, `computed`, `effect`, `resource`, dependency rules E1201 and E1202 |
| k.store | stores, transactions, ids and invariants, view stores, log meta and limit |
| k.ctx | `ctx` capabilities: clock, random, net, and `observe` for kernel events |
| k.owner | who creates and ends a ctx, `createCtx` with a signal |
| k.errors | `Result` values for expected failures, error boundaries, the three layers |
| k.attempt | `attempt(fn, expect)`, `err`, causes, throwing built-ins, E1457, E1458 |
| k.defects | `defect`, its literal message, data and cause, E1455 |
| k.shared | module state on a server: what a request may write, E1256 |
| k.expect | what `expect` claims and an error carries, made errors, `keelError`, E1460 |
| k.supervise | `supervise`: code that runs other code and survives its throws, E1461 |
| std.statecharts | flat state charts compiled to a store and transactions, E2751 to E2755 |
| std.geo | `geo` capability with a seeded simulation |
