# ADR-0006: Streaming SSR with islands is the invisible default

**Status:** accepted
**Context.** Performance is a top pain point; hydration cost is real; the agent should not choose a rendering mode.
**Decision.** Server renders, islands hydrate with serialized state and resume, static routes prerender. No dual module graph (no RSC-style serialization rules in user code).
**Alternatives.** CSR only (slow first paint); RSC (novel, strict rules); full server-driven (latency-bound UI).
**Consequences.** `.server.ts` boundary enforced at compile time; shells build from the same static output.
