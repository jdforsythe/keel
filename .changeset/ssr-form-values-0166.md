---
"@keel/forms": minor
"@keel/ui": minor
"@keel/std-timings": minor
"@keel/server": patch
---

Server-rendered forms show their values, and timings keep names with history (backlog 0166, 0172; RFC 0062). `Field.bind` writes the value of its first sync as the control's markup default: the `value` attribute of an input, a textarea's text, `selected` on the chosen option, `checked` on a checkbox or radio. A `password` or `file` input gets no `value` attribute. `@keel/ui` `Input`, `TextArea`, `Select` and `Checkbox` do the same for a reactive `value` or `checked`. If a control already differs from its markup default at bind, because the user typed before the page went live, the field takes the user's value and the markup is left alone. The server DOM writes a second newline after `<textarea>`, `<pre>` or `<listing>` when the text starts with one, and its parser drops one, as the HTML parser does. A browser treats these as defaults, so an edit page served by `createApp` shows its values before any script runs, and user edits, `set` and `reset` still change only the property. In `@keel/std-timings` the 256-name cap is now a segmented LRU. A name's second call moves it to a protected segment of at most 192 names, and a new name at the cap evicts the least recent unprotected name. A kept name with a count of 2 or more is evicted only after 192 other names had a repeat call since its last call. A crawl of request-derived names no longer erases `db`, and `dropped` counts only evicted names.
