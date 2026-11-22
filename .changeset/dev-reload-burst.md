---
"@keel/compiler": patch
---

`keel dev` loads the server graph again whole when a file that registers a capability changes after another edit and before the next request, where that request and every one after it answered 500 "capability ... is already registered" until a further edit. A load that an edit overtook is invalidated whole once it settles and its requests wait for the next load; a load that fails is tried again by the next request.
