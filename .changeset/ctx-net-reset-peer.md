---
"@keel/ctx": patch
---

A real ctx's `net` on Node fails a request whose peer resets the connection as it is set up as a rejected fetch (`TypeError`, as a refused connection's), where Node's fetch on macOS threw `setTypeOfService EINVAL` from a socket event and ended the process.
