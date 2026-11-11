# ADR-0099: named slots are props; a component's second argument is `undefined` (RFC 0084)

**Status:** accepted (2026-11-11), user decision D1, under the WORKFLOW RFC default 2.

**Context.** k.component reserved the second component argument "for named slots (later RFC)", while `children` and the standard slots (`loading`, `empty`, `error`) were already props, and the router typed the argument as `undefined`. The widgets need named render functions (`option`, `panel`, `cells`).

**Decision.** A named slot is a prop whose value is a function returning JSX, typed with the component's props and kept out of its `Props` schema. The receiving component calls it in its own scope, once per place it renders (inside a `For`, in that row's scope, disposed with the row); its arguments are values and accessors, never DOM nodes. The second argument is always `undefined`. A stdlib widget gives each element it renders the id `<id>.<part>` from its `id` prop. k.component goes from 788 to 988 tokens.

**Alternatives.**
- A `slots` argument beside props, rejected: two ways to pass the same function.
- Removing the parameter, rejected: `ctx` would move from third to second place in every component that takes it.

**Consequences.**
- The `Slots` type becomes `undefined` in `Component`, `Island` and `TestComponent`; no caller passes a second argument today.
