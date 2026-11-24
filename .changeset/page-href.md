---
"@keel/router": minor
"@keel/server": minor
---

`pageHref(routes, text)` (`@keel/router/match`) reads a string, such as a guard's `next`, into an `Href` of a page of the route table, or `err` `keel.notFound` (`not a page`): it refuses text over 2,048 characters, a path that is not exactly one leading `/`, a backslash or control character, `%2F` or `%5C` in the path, a `.` or `..` segment, a path no page matches (API entries and the identity mount included) and a guard's `redirect` page, and rebuilds the answer from the match. An action's `fn` args carry `routes`; `run` without `routes` gives `routeTable()`. `handle.fn` of an identity source gets `{ routes }` as its third argument.
