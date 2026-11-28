# openapi-import

A typed client from an OpenAPI 3 document. `openapi.json` describes one operation, `getQuote`, on a server at `http://localhost:4417`. `keel scaffold service app --openapi openapi.json` wrote (`--name <name>` would name the declaration after the service, `<Name>Api`, instead of the module) `modules/app/AppApi.schema.ts` and `modules/app/api.server.ts`; both are generated, so change the document and run the command again instead of editing them. The home page loader in `modules/app/loadHome.server.ts` calls `api.getQuote` and shows the quote, or the error code when the call fails.

`test/quote.test.ts` answers the service with sim `ctx.net` routes. Run `keel check`, `keel test` and `keel build`; `node dist/web/server.mjs` serves the page and calls whatever listens on port 4417.
