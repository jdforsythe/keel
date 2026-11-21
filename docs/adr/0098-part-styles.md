# ADR-0098: apps style a stdlib component by part, through the compiler (RFC 0084)

**Status:** accepted (2026-11-11), user decision D1, under the WORKFLOW RFC defaults 1 and 2.

**Context.** The compiler collects style props from k.ui base elements only, and a style state is `hover`, `focusVisible`, `active` or `disabled`. An app could not style the inner elements of a component it did not write, nor a selected, checked, expanded or highlighted option.

**Decision.** A component from a `@keel/std-*` package takes `styles={{ <part>: { <style props> } }}`. The compiler collects each part's style props as it collects a base element's and emits the same atomic classes; the component passes them to that part's `Part` or base element. There and on `Part`, `states` also takes `selected` (`[aria-selected="true"]`), `checked` (`[aria-checked="true"]`, `:checked`), `expanded` (`[aria-expanded="true"]`) and `highlighted` (`[data-k-highlighted]`). The rule lives in k.aria.

**Alternatives.**
- A stylesheet shipped by the stdlib package, rejected: a visual opinion, and a cascade that reaches into components (principle 2).
- A `class` prop on widgets, rejected: k.ui has no class prop and styles through tokens only.

**Consequences.**
- No widget ships CSS or picks a token; an unstyled widget renders with platform defaults.
- k.compiler's text is unchanged; the collection rule is specified in k.aria.
