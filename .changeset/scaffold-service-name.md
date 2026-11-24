---
"@keel/scaffold": minor
"@keel/cli": minor
"@keel/services": minor
"@keel/check": patch
---

`keel scaffold service <module> --name <name>` names the declaration `<Name>Api` (`<Name>Api.schema.ts`); `name` is lowerCamel, else E1352, and defaults to the module id. `openapi(doc, { name })` takes the same rule and throws a `RangeError` outside it. E1351 for an existing service names `api.server.ts` first.
