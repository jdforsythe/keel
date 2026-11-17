---
"@keel/router": minor
---

An API route's action declares `output`: `action({ input, output, params?, stores? }, fn)` returns an `ApiAction` whose `fn` answers `ok(value)` of `output`'s type and gets `bearer`, the request's `Authorization: Bearer` token as a `Secret<string> | undefined`. A page's action declares no `output` (`Action` has `output?: never`) and still answers `ok(href)` or `ok(null)`. `routes.actions` refuses an action without `output` on an API route, or one with `output` on a page: a type error carrying the E1512 message, and a throw with `code` E1512 over an untyped table. A guard's and a loader's `fn` get `bearer` beside `caller` (`undefined` off an API route), and their `run` takes it as optional. `loader()` and `action()` throw E1113 at declaration when their `output` holds an `s.secret` node, naming its path.
