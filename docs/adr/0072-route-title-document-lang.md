# ADR-0072: a route names its document's title and the locale sets its language (RFC 0079)

**Status:** accepted (2026-11-10), user decision D10, under the WORKFLOW RFC defaults 1 and 3. It narrows ADR-0067: the deployable's name becomes the fallback title.

**Context.** A node document's `<title>` is the deployable's name and `<html lang>` is `en` on every page (ADR-0067), so a German recipe page is announced in English under the app's name. The title is page text and belongs in the route's message set; the page's language is the route's locale. k.router and k.server are at the 1,500-token section cap.

**Decision.**
- A path route may declare `title: (props) => string` over the route component's props `{ params, search, data }`. The document's title is the matched route's `title`; without one, after a loader `err` in the chain, and for a 404, it is the deployable's name, or the `index.html` title in a `client` deployable.
- `<html lang>` is the matched route's value of its prefix param (ADR-0070), read from the matched params; a route without one keeps `en`.
- The server writes both into the head ADR-0067 defines. At `mount`, at `resume` and after each navigation, the client router sets `document.title` and `document.documentElement.lang` where they differ, rebuilding no element or text node.
- A string literal with a letter returned by `title` in a module that lists `@keel/std-messages` is E2406.
- The head paragraph and its clause move from k.server into a new section, k.head, unchanged in meaning.

**Alternatives.**
- `title` as a message key string, rejected: the route does not know its set, and a title with params needs a function.
- `{route title} · {deployable}`, rejected: the deployable's name is not copy and is not translated.
- A `lang` field on every route, rejected: it repeats the locale the prefix param already holds.
- `<html lang>` copied from the shell's root `lang`, rejected: an attribute inside a layout would change the document (principle 2).
- Splitting k.router's Client and Form paragraphs out, rejected: at least four quoted clauses would move (navigation, focus and scroll, Form, action results), against one for the head.

**Consequences.**
- k.server drops from 1,500 to 1,462 tokens; k.head is 686; k.router gains one pointer sentence and stays at 1,499 after one trim.
- `packages/server/conformance/document-head-0078.test.ts` cites k.head under rfc:0079.
- An app whose every URL carries the prefix (no `pathDefault`) keeps `lang="en"` on the document while its content's `lang` marks the language.
- `@keel/server` grows by about 0.2 kB gzip and stays within 14.5 kB; `@keel/router`'s re-base to 9 kB covers the client writes.
