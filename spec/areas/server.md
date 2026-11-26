# server
| id | holds |
|-|-|
| k.server | loaders and actions over HTTP, server stores, request flow, document and log |
| k.leave | what a request leaves in the document, process state and after the response |
| k.user | identity source, `user` and `caller` of a request, user header, caller lifetime |
| k.mount | identity mount declaration, `MountHref` links and navigation to the identity source |
| k.mount-scope | which paths count as under the identity mount, and the limits of that test |
| k.serverlog | length caps, scrubbing and cut markers for server log records |
| k.services | typed service clients over contracts, `ApiError` and request encoding |
| k.openapi | client, schema and service text generated from an OpenAPI document |
| k.server-deps | environment variables, bundled package files and registration through a library |
| std.jobs | durable background jobs with retry and lease, diagnostics E2501 to E2506 |
| std.schedules | cron schedules in a time zone, catch-up of missed runs, E2551 to E2553 |
| std.workflows | chart instances run over jobs, manifest entry, inspector hook, E2351 to E2355 |
