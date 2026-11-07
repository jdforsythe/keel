---
"@keel/check": minor
---

k.module (RFC 0035): E1151 and E1157 carry a fix adding the name to the owning module's `public.exports` / `public.routes`; E1155 carries a fix prefixing the id with `<module id>.`. No fix edits a file under `node_modules/` (stdlib packages), so E1152, E1154, and E1156 on a stdlib manifest no longer carry one.
