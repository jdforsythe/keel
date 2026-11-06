# ADR-0007: All effects through `ctx`

**Status:** accepted
**Context.** Determinism, simulation, shells, and testability all require injectable effects.
**Decision.** Clock, random, net, storage (kernel) and stdlib capabilities are declared interfaces with real, shell, and simulated implementations. Bare globals are compile errors in app code.
**Alternatives.** Mocking globals (fragile); DI container (implicit).
**Consequences.** Session replay, deterministic simulation, and Capacitor/Tauri adapters are the same mechanism.
