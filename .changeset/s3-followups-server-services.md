---
"@keel/server": minor
"@keel/services": minor
"@keel/compiler": minor
"@keel/cli": minor
---

`createApp({ maxStreams })` caps open event streams per app (default 1,000); one more is 503 `keel.busy`. A `service({ module })` call returns the route's value: a GET decodes the loader's `ok` value with `output`, an action decodes its `ok` value, and an error is `api.status` with `body` decoded by `errors[status]`. `surface.json` records those answers and `version: 1`. In dev, a `node` deployable's documents load `/@keel/entry.ts?d=<deployable>`.

Migration: a `module` endpoint's `output` is the loader's value (or `Href | null` for an action), not the `{ ok, value }` answer; delete reply schemas that mirrored it. A same-app `service({ base })` becomes `service({ module })`. Run `keel build` to regenerate `surface.json`.
