# ADR-0181: custom components: `Part` open to apps, the host element (RFC 0159)

**Status:** accepted (orchestrator).

**Context.** An app could not write a widget the stdlib does not ship, because E1822 kept `Part` from app code. Nothing gave outside code, such as a chart library, d3 or a custom element, a node, a lifecycle or a text alternative. The stdlib's list behaviour was private. D44, D48 and D50 set the shape of the fix.

**Decision.**
- `Part` is open to app code, and E1822 is retired.
- `Part` gains `grid` and `gridcell`, `tree` and `treeitem`, a `slider` that is `input type=range`, and a `radio` that is `input type=radio` inside a `radiogroup` (k.roles).
- `@keel/std-headless` exports `listChart` and `stableRows` (std.lists). No grid movement primitive exists: a grid's key map is the component's own pure function.
- Outside code runs in one element, `Host` (k.host-element; its code's contract in k.host-code), and `customElement` is its thin case:
  - It takes a schema-typed `value`, a required role (`img` or `group`) and a text alternative.
  - Its code is loaded with a literal dynamic import. `mount`, `update` and `dispose` run client-only, and `update` runs once per frame by reference.
  - Its code reports back only through a schema-typed `emit`.
  - The harness and replay never run the code. The ledger counts the element.
- The content security policy and Trusted Types stay fixed. A stylesheet import is allowed only in a host element code file.

**Alternatives.**
- A stdlib date picker and tree: D50 rules these out.
- A narrowed E1822: it would be a second list to keep in step, and no role is harmful in an app.
- A `div role=slider` or `div role=radio`: these rebuild native controls.
- A drawing element: D48 rules it out.
- `ref` in any component: the harness, replay and the ledger could not tell which components hold a node.
- Static library imports: the server would evaluate the library, and it would load on every page.
- The name "host element": it collides with `host` (k.hosting) and k.host.

**Consequences.**
- A date picker, a tree or a chart is app code that `keel check` and the a11y checks see whole, apart from a host element's drawing. The ledger counts that drawing as opaque.
- Under the fixed policy, d3 (without `.html()` and the style attribute), Chart.js and uPlot run in full. Observable Plot draws, but without its injected CSS or its ramp legends. ECharts runs only with the SVG renderer and `richText` tooltips.
- `TestEvent`, `CtxEvent` and `SessionEvent` gain `emit`, and the ledger file gains `hostElements`.
