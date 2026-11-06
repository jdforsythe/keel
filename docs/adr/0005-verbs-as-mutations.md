# ADR-0005: HTTP verbs are the mutation API

**Status:** accepted
**Context.** Client mutation libraries add a second vocabulary over what HTTP already expresses.
**Decision.** Actions on routes keyed by method; `<Form method action>` is the mutation primitive; automatic revalidation. Request/Response/FormData/URL are the data types.
**Alternatives.** `useMutation`-style hooks (duplicate vocabulary); RPC-only (loses progressive enhancement).
**Consequences.** Progressive enhancement free; agent mental model is "it's HTTP".
