---
"@keel/testing": minor
---

`renderRoute(id, { shell: true })` reports a launch with no link before the first render; with `launch: 'later'` it reports none until the handle's `launch(links)` (`null` for a failed read). Under a shell, a `fire` of `click`, `submit` or a non-Escape `keydown` is a person's act; any other `fire` and the handle's `navigate` are not.
