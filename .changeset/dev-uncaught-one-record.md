---
"@keel/server": patch
---

Under `keel dev`, an uncaught error writes one E1577 record with the route of its request after the dev server restarts or a linked package's edit loads the server graph again, where it wrote a second record with route `-` for each earlier load.
