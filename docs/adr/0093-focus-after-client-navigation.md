# ADR-0093: focus moves to the page heading after a client navigation (RFC 0083)

**Status:** accepted (2026-11-10), under the WORKFLOW RFC default 6.

**Context.** After a client navigation the router set `document.title` and `<html lang>` and wrote nothing else (k.head), so focus stayed on the activating link, which the new page may have removed. A screen reader user heard nothing of the new page (WCAG 2.4.3).

**Decision.** After a navigation to another route, the router focuses the page's first `h1`, adding `tabindex="-1"`, else `main`. A navigation that changes only the search keeps focus. The behavior lives in k.head's Client paragraph and its new clause (671 to 766 tokens).

**Alternatives.**
- A live region announcing the title, rejected: the title already changes, and a focused heading is read and starts the reading position at the new content.
- Focusing `main` first, rejected: some screen readers then read the whole region.
- Leaving focus to the app, rejected: every app would repeat the same code (default 6).

**Consequences.**
- `document.activeElement` changes after navigation; no router test asserted it.
- The golden-3 acceptance test asserts focus on the `h1` after navigating from `/` to a shift.
