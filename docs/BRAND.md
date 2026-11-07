# Brand and style guide

Monastic Utilitarianism (Rev. 2024.04). Applies to everything Keel ships or publishes: the GitHub README, the framework site, example apps, the inspector, scaffold templates, docs, and diagnostics. Marks: `docs/brand/keel-mark.svg`, `docs/brand/keel-logo-lockup.svg`.

## 1. Philosophy
Keel is a full-stack web framework whose primary author is a coding agent, not a person. The brand rejects software marketing tropes (gradients, glassmorphism, AI illustrations, nautical kitsch) in favor of archival authority, mid-century technical manuals, and printed mathematical texts. Every visual device has structural meaning.

## 2. Color (WCAG 2.2 AA)
A high-contrast parchment surface with deep charcoal text. ISO Ochre is reserved strictly for conformance rungs, status badges, and active diagnostics.

| Role | Hex | OKLCH | Contrast vs `#F9F9F9` |
| --- | --- | --- | --- |
| Surface (background) | `#F9F9F9` | `98% 0.001 80` | base |
| Surface-container-low | `#F3F3F3` | `96% 0.002 80` | 1.1:1 (UI container) |
| Surface-bright (card) | `#FFFFFF` | `100% 0 0` | 1.05:1 |
| Text primary / Charcoal | `#18181B` | `18% 0.01 260` | 13.5:1 (AAA) |
| Text secondary / Stone | `#71717A` | `50% 0.01 260` | 5.2:1 (AA) |
| ISO Ochre (accent) | `#C2410C` | `55% 0.18 45` | 4.8:1 (AA) |
| Verified Green | `#15803D` | `52% 0.15 145` | 5.1:1 (AA) |
| Error Crimson | `#B91C1C` | `48% 0.20 25` | 5.4:1 (AA) |
| Hairline divider | `#E4E4E7` | | 1px solid, light mode |

## 3. Typography
- Prose and display: Source Serif 4 (SIL OFL). Headings, spec titles, narrative body copy.
- Code, diagnostics, numbers: JetBrains Mono (SIL OFL). Tabular figures, unambiguous `0`/`O` and `1`/`l`/`I`, ligatures off for hashes and code.

## 4. Layout and components
- Geometry: zero border radius on cards, buttons, inputs.
- Dividers: hairline `1px solid #E4E4E7`, used only to separate compositional blocks.
- Diagnostic block: monospace container with the code (`E1042`), the path (`src/cart/add.tsx:14:7`), one line of message, and the exact unified diff hunk (`-`, `+`). This is the OUTPUT.md diagnostic shape rendered.

## 5. Voice and vocabulary
The sentence-level rules live in `docs/VOICE.md` (first person, reader as the hero, concrete nouns and numbers, no em dashes, no reversals, no hedging, the full banned list). Two brand-level rules: claims never exceed what the ledger shows (PRINCIPLES 11), and the only nautical term is *Keel*.

## 6. Where it lives in code
- `@keel/ui` tokens: the scaffold `project` template emits `tokens.ts` with this palette, these fonts, radius 0, and the hairline divider, so every new app starts on brand. Apps: `apps/golden-1`, `apps/golden-2`, `apps/inspector`.
- Fonts are self-hosted (`@keel/ui/fonts`), never fetched from a third party at runtime (THREAT-MODEL CSP).
