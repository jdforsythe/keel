---
"@keel/router": minor
---

`identityMount(path, { links })` declares exact mount subpaths a shell takes from a link at any time (`links`, `[]` by default; an entry not of `href`'s subpath form, `''` or repeated throws E1584). A shell's intake sorts each return link by its path: a page navigates at any time, a declared path is one mount request GET, any other mount path takes the pending opening first. From a taken link until a person's act (a trusted pointer, touch or non-Escape key input), no mount request records an opening. `mountRequests` returns `{ link, launch, fired }`: until the shell reports its launch, an opening made with no act is held; a report of no link records it, a failed read or launch links drop it and make the ctx link-started until a person's act. A mount answer's `location` or a return link whose path begins `//` or `/\` once dot segments are removed is ignored.
