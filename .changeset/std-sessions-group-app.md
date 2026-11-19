---
"@keel/std-sessions": patch
---

`./group` loads each user's modules through the project's Vite config (the Keel compiler's plugin), so app modules with stores and components load; the worker's DOM is the harness's (Vitest `happy-dom`, its `FormData` included); a response body a user cancels is cancelled at the server and later chunks are dropped; the cookie jar honors `Max-Age`, `Expires`, `Path`, `Secure` and the cookie prefixes and sets `cookie` on the built request, so a user keeps one caller; `replayGroup` throws E2007/E2008 before starting workers. `replay` passes over an input it already reproduced as an earlier input's effect (a click's `submit`, an action's `nav`), and an input that cannot apply is the replay's `E2003` error, so it is not reproduced.
