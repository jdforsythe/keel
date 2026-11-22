---
"@keel/router": minor
"@keel/server": minor
"@keel/std-channels": minor
"@keel/std-live": minor
---

A live loader's args have `currentUser()`: the identity source's `identify` run again on the request the stream opened with, `''` for a throw, an invalid answer or no answer in 5,000 ms; with no identity source `''`, and for a stream whose `user` a verified `x-keel-user` gave, that `user` with no `identify` call. A channel route asks it before each delivery to an open stream, an answer less than 1,000 ms old standing, and closes the stream `denied` when the answer is not the stream's `user`. `live` is `denied` once a read is refused (`api.status` 401 or 403, or `keel.denied`): it commits nothing, closes the stream and reads no more.
