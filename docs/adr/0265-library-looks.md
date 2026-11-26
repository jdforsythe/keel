# ADR-0265: a library ships its look; color schemes; more Part roles (RFC 0243)

**Status:** accepted (orchestrator, 2026-11-26), to be confirmed by the operator.

**Context.** A library could not ship a look. It named tokens and hoped the app had them, and a missing name surfaced only at the app's `keel build`. Token names were bare, so two libraries could collide. Dark mode had pairs and a media query, but no choice, no `color-scheme` and no declared set of schemes. `Part` had no switch, toggle button, toolbar, menu bar, radio menu item, meter, progress bar or region. D188 set the direction for library tokens.

**Decision.**
- A library ships `<id>Tokens`, one `defineTokens` literal in `src/<id>Tokens.ts`, from its `./tokens` entry. Every name is `<id>.<name>`. The literal has no `base` and no `schemes`, and `keel check` reads it as text (E1812).
- The app spreads it into its own `tokens.ts`, group by group. `brandTokens` names stay unprefixed as the app's own.
- A library's needs are derived: exactly the names its object ships. Its files write only those (E1811). The app's tokens must hold them all: one E1810 per library at `tokens.ts`, with a fix that writes the import and the spreads. A dotted key that no listed library ships is E1813.
- In its own folder a library's fixture `tokens.ts` composes the shipped object and overrides nothing (E1810, E1813), so contrast, focus and render checks judge its defaults. `keel pack` runs them in its `check` step.
- `tokens.ts` takes `schemes` (`light`, `dark` or both). Without it, an app has both only when its own colors hold a pair.
- With both schemes, the CSS follows the system preference until `data-k-scheme` on `<html>` overrides it, and `color-scheme` is declared.
- `SchemeSelect` is the one control for the choice and writes the `keel-scheme` cookie. A `node` document renders the choice. A `client` or `static` document that offers the control loads a classic script of at most 300 bytes before its stylesheet. Contrast is judged per declared scheme, and `SchemeSelect` in a one-scheme app is E1814.
- `Part` gains the roles `switch` (a native button), `toolbar`, `menubar`, `menuitemradio`, `meter`, `progressbar` and `region`; `button` gains `pressed` and `describedBy`; `menuitem` gains `hasPopup` and `expanded`. Keys stay the component's own.

**Alternatives.** A hand-written `needs` list, which can drift; bare needs the app must define; a nested group per library; a `composeTokens` helper beside spreading; running the shipped file at check; a library shipping `base`; dark mode from pairs alone; the choice in `localStorage`; an inline script under a CSP hash; `ctx.scheme`; a checkbox-based switch; every missing role at once.

**Consequences.** New codes E1810 to E1814, and new sections k.looks and k.schemes. k.ui and k.roles read `implemented` until their clauses are covered. This builds on RFC 0241's E1801 at `keel check` and merges after it. `docs.map` is re-based from 1,690 to 1,710. Tooltip, treegrid, feed, window splitter, carousel and a breadcrumb's current link wait for one follow-on RFC. The brand stays light-only until a brand task gives it a dark palette.
