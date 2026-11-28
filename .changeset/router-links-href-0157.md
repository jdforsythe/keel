---
"@keel/router": patch
"@keel/server": patch
"@keel/ui": patch
---

A link is followed only when it is an `Href`, on the server and in the client. A page action's `ok` value that is neither `null` nor an `Href` is 500 `keel.unexpected` on a document and a JSON request alike, before any store is saved, with no `location` and none of the value in the answer or the diag; in the client router it is `keel.unexpected` given to the `Form`, and nothing navigates. `navigate` of a value that is no `Href` once each `\` reads as `/` and a hash drops rejects with E1501, a `Form` whose `action` is none throws E1501, and a `Link` whose `to` is none renders `about:blank`. `isHref` refuses C1 control characters too.
