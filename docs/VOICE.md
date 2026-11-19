# Voice guide

Every piece of prose Keel ships follows this: documentation, code comments, commit messages, web copy, README files, skill text, diagnostics, and the words inside the example apps. The brand guide (`docs/BRAND.md`) owns color, type, and layout; this file owns the sentences. The mechanical rules are enforced by `tooling/voice-lint.mjs` (V0003) in `pnpm check`: banned words (every "just", "landscape" and the hedging adverbs included), em dashes (and ` -- `), "here's the thing", "the whole story" and "it's not X, it's Y" reversals. It reads prose only: code spans and fenced code are skipped, as are this file and the brand guide; it covers `docs/`, `spec/`, README files, skill text, the copy and comments of the example apps' modules and the comments of `packages/*/src`. The other rules, "navigate" as a metaphor among them, are review judgment.

## Stance

Write in the first person where a person or the project is speaking, and address the reader directly. The reader is doing the work; the text is the guide. Describe what the code does and what the ledger shows, never more. A claim that outruns the evidence is a bug (PRINCIPLES 11).

## Sentences

Vary sentence length on purpose. A long explanatory sentence can land on a short one. Prefer concrete nouns and specific numbers: "the React boilerplate", not "existing frameworks"; "twelve PRs a day", not "many". Use American spelling and idiom.

End a paragraph on its strongest concrete point, not on a sentence that sums it up.

## Avoid

- Em dashes. Use a comma, a period, or a colon.
- Reversals of the form "it's not X, it's Y", and short negation-then-correction pairs ("It wasn't the tool. It was the carpenter."), unless rewritten as one natural sentence.
- "Here's the thing", "the whole story", triplets added for rhythm, and lists of fragments.
- A rhetorical question answered by the next sentence.
- A thesis sentence followed by a restatement of it.
- A tidy summarizing sentence that closes a paragraph.
- Colon-headed label sentences ("The result: ...") in running prose. Reference docs may use bold run-in labels for lookup, as `docs/OUTPUT.md` does; narrative prose may not.
- Inline bold for emphasis in body prose. Bold is for labels in reference tables and lists only.
- Hedging adverbs: arguably, somewhat, relatively. Say it or leave it out.

## Banned words

Enforced by `tooling/voice-lint.mjs` (V0003): seamless, powerful, blazing, magic, revolutionary, effortless, simply, just (as an intensifier), leverage, robust, cutting-edge, AI-powered, supercharge.

Also banned: crucially, fundamentally, importantly, delve, navigate (as a metaphor), landscape (as a metaphor), game-changer, paradigm, rapidly evolving.

The only nautical word is Keel.

## Where it applies

| Surface | Notes |
| --- | --- |
| `docs/`, `spec/`, README files | Reference docs may use the OUTPUT.md run-in label style; everything else is narrative prose. |
| Code comments | Same rules. A comment states what the code guarantees and why, in one or two sentences. |
| Diagnostics | Message under 90 chars, optional fix as a unified diff hunk (OUTPUT.md). |
| Example apps and the inspector | Page copy, empty states, labels, and errors. The copy is part of the product. |
| Skills | The agent reads these as instructions; plain and specific, no sales language. |
| Commit messages, RFCs, ADRs | Same rules; numbers and file names over adjectives. |

## Examples

Rewrite: "Keel is a powerful, blazing-fast framework that seamlessly handles state."
To: "Keel compiles JSX to DOM operations and keeps every state change in a named transaction. The todo app renders in 3.4 kB of runtime."

Rewrite: "It's not the framework that's slow, it's the reasoning."
To: "The framework is fast enough; the agent's reasoning about invisible rules is what costs tokens."

verified: 77789dc00be5d2148ac923e67e435ac901f804ee
