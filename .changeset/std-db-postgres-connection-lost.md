---
"@keel/std-db": patch
---

A Postgres connection lost while a commit is in flight rejects that commit with the server's error code and the pool goes on; the process never exits on an unhandled `error` event from the client.
