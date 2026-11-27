# Vision

Most new application code is now written by agents, and every framework they write it in was designed for humans: flexible, forgiving, full of choices and invisible rules. Agents read through a narrow window, never learn a codebase, and converge by running checks. Human frameworks punish exactly that.

Keel is a full-stack web framework built for that author. It optimizes for predictability, token cost, and verifiability over writing ergonomics. One way to do each thing. A spec small enough to load. Tooling that returns errors with fixes. A runtime that is inspected rather than reasoned about. A verification ledger that states what has been proven, tested, or merely run.

The user writes four things: schemas for what the data is, transactions for what can happen to it, components for how it looks, and a contract for each module's routes, bound to its views and handlers, for how it is organized. Everything else is a declaration or a derivation.

The product is the spec, its conformance suite, and the feedback loop. Runtime implementations are borrowed where mature and replaced only when the spec demands it.

subject: docs/adr/ spec/00-map.md
verified: 2ddcb6456c160264ab2ee90fcb5e8927c08514bd
