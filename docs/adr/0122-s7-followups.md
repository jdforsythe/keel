# ADR-0122: getter props in k.ui, `styles` on any component and E1823, a closed audited search list, `#` specifiers as E1576 (RFC 0099)

**Status:** proposed; the orchestrator accepts or reverses it under the WORKFLOW RFC defaults.

**Context.** S7 left four gaps. k.ui does not say which props follow a changing source; the runtime binds every getter prop, and compiled JSX passes every non-literal value as one, but `TableSearch` builds its `Input` by hand with `label` copied once. The compiler drops a non-literal `styles` with no diagnostic, so its CSS is missing. The E1111 rule and the part-styles collection name stdlib packages. E1822 and E1576 read specifier text, and a `#` specifier resolves through a `package.json` no rule sees.

**Decision.**
- D1: k.ui states one rule: a getter prop updates what it writes as its reads change; `as`, `level`, `role`, `field`, `children`, event props and an id derived from `label` are read at build. `TableSearch` passes `label` as a getter. No prop's type widens; `@keel/ui` source is unchanged.
- D2: `styles` on any component other than a base element or `Part` is part styles; the compiler's stdlib package list goes. A `styles` value, part or spread that is not an object literal is E1823 (k.aria, no fix), except a read of the component's `props.styles` or a member of it. A same-file `const` is not read.
- D3: no registry for search factories. Every channel from a stdlib package to the kernel trusts the name `@keel/std-[a-z0-9-]+`, so a declared registry would let any package under that name exempt its exports from E1111. The audited list in `@keel/check` stays closed, one entry (`tableSearch`), each entry backed by its package's conformance test of the refusal; k.privacy says so.
- D4: E1576 reports every `#` specifier in app code; the checker reads no `package.json`.
- Budgets: `@keel/compiler` to 30kb, `@keel/check` to 48.25kb.

**Alternatives.**
- A signal or computed for label-like props, rejected: a second way beside the getter, and a new API shape.
- Reading a same-file `const` for `styles`, rejected: a second form, and imports stay unread.
- Keeping the package list in the compiler, rejected: a wrapper's forwarded `styles` stays dropped and the compiler names each stdlib package.
- A `./tools` or `package.json` registry, rejected: the trust is the same name prefix, widened from one audited export to every package under it.
- Resolving `#` through `package.json` `imports`, rejected for now: a new `keel check` input and Node's resolution rules in two rules, with tsconfig `paths` still unread.

**Consequences.**
- A label or other prop an app changes while mounted follows it in JSX and in `.ts` calls that pass a getter; the spec says which props are read once.
- An unreadable `styles` fails `keel check` and `keel build` with E1823 instead of shipping without its CSS; app wrappers that forward `styles` get their callers' literals collected.
- The compiler names no stdlib package; `@keel/check` names one audited export, by design, until E1111 can read the evaluated `routes.json` (open question).
- App code cannot use `#` imports.
- k.security is at 1,499 tokens and k.aria at 1,495.
