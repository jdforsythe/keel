# live
| id | holds |
|-|-|
| std.channels | named channels over a server event stream, stores and followed app data, E2601, E2602 |
| std.channels-limits | caps on open streams per user or caller, per module and anonymous per process |
| std.live | client store re-read on every push from a channel |
| std.offline | queued writes with keys and bases, resolve step and diagnostic E2651 |
| std.outbox | outbox behavior when storage writes reject or never settle, or a flush throws |
| std.outbox-owner | `writeFor` refusing a write whose owner is not the caller, `offline.owner` |
| std.conflicts | order-dependent rebased entries reported as races, E2701 |
