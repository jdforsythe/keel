# state
| id | holds |
|-|-|
| k.reactive | `signal`, `computed`, `effect`, `resource`, dependency rules E1201 and E1202 |
| k.store | stores, transactions, ids and invariants, view stores, log meta and limit |
| k.ctx | `ctx` capabilities: clock, random, net, and `observe` for kernel events |
| k.owner | who creates and ends a ctx, `createCtx` with a signal |
| k.errors | `Result` values for expected failures, `KeelError` and error boundaries |
| std.statecharts | flat state charts compiled to a store and transactions, E2751 to E2755 |
| std.geo | `geo` capability with a seeded simulation |
