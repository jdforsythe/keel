# shell-mount

A note behind a sign-in guard, in a Tauri shell. The `web` deployable in `topology.ts` is a `client` with `shells.tauri`, served by the `api` node, which mounts the identity source of `identity.server.ts` at `/api/auth`. That source is a stand-in for an auth library: the name typed on the sign-in page becomes the user, kept in a cookie. A real app hands `identify` and `handle` to its library.

`modules/notes/signedIn.guard.ts` guards `/notes/:noteId`. A page in a `client` deployable gets `user` as `''`, so the guard asks `/api/me`, which the api answers from the cookie. A signed-out reader who opens the note is sent to `/signin?next=/notes/n1`; in the shell, the sign-in form posts to the mount through the native HTTP client, and its 303 goes back to the note.

`test/shellGuard.test.ts` runs the pages as in the shell (`renderRoute` with `shell`). Run `keel check`, `keel test` and `keel build`; `KEEL_ORIGIN=<api origin> keel build --target tauri` builds the shell.
