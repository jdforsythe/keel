# RFC 0013: services: api.input for invalid call input

Status: draft

## Problem
A call whose `params`, `query`, or `body` fail their schemas is the caller's bug, but k.services has no code for it, so it is reported as `api.decode`. That code means a response body failed `output`; callers cannot tell "I sent bad input" from "the server sent bad data" (services PLAN D4).

## Proposal
Add `api.input` `{ issues }` to `ApiError`, with `schema.invalid`'s issue shape. Issue paths are prefixed `params`, `query`, or `body`. It is returned before anything is sent. `api.decode` stays for response bodies only.

## Alternatives
- Keep `api.decode` for both: ambiguous.
- Reuse `schema.invalid`: breaks the closed `api.*` union.

## Spec diff
k.services: `api.input` in the ApiError list; Conformance gains "invalid call input returns `err` `api.input` with issue paths prefixed params/query/body and sends no request".

## Conformance diff
Add `packages/services/conformance/api-input.test.ts`. Existing tests unchanged.

## Migration
Additive to the union; callers matching input failures on `api.decode` switch to `api.input`.

## Token impact
About 40 tokens in k.services.
