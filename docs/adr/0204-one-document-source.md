# ADR-0204: k.head, k.topology: Keel writes every document; a deployable's `styles` carries its CSS (RFC 0182)

**Status:** accepted (orchestrator, under the RFC defaults).

**Context.** `keel dev` serves a `client` project's own `index.html`, and a `node` deployable's documents, in dev and build, never read it. What an author puts there, a header or the brand fonts, shows in one path only, and the fonts never ship for a `node` deployable. No other way brings a stylesheet to a document: k.head has `title` only, and a `.css` import in app code is E1825.

**Decision.** Keel writes every document: k.head's on a server and a generated `index.html` for a `client` deployable, in dev and build. A project's `index.html` is never read; W1012 names one when present. A deployable's `styles` lists package `.css` exports (`['@keel/ui/fonts']`), each imported by its entry, so its documents link them; a bad entry is E1587. The scaffold writes no `index.html` and adds the fonts to `styles`.

**Alternatives.** Reading `index.html` everywhere (two head writers, one with a nonce policy); fonts in every document (an app's typography is its own); a per-route `links` API (fonts are per deployable); an error for the file (it is harmless unread).

**Consequences.** Dev and build serve one head on every adapter. Apps drop their `index.html`. k.head reads `implemented` until its clause is covered; k.topology and k.scaffold gain clauses. New codes W1012 and E1587.
