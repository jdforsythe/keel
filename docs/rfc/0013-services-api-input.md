# RFC 0013: services: api.input for invalid call input

Status: implemented

## Problem
A call whose `params`, `query`, or `body` fail their schemas is reported as `api.decode`, which also means a response body failed `output`. Callers cannot tell their own bad input from bad server data (services PLAN D4).

## Proposal
Add `api.input` `{ issues }` to `ApiError`, with `schema.invalid`'s issue shape. Paths are prefixed `params`, `query`, or `body`. Returned before anything is sent. `api.decode` stays for response bodies.

## Alternatives
- Keep `api.decode` for both: ambiguous.
- Reuse `schema.invalid`: breaks the `api.*` union.

## Spec diff
k.services: `api.input` in the ApiError list; one Conformance sentence.

## Conformance diff
Add `packages/services/conformance/api-input.test.ts`.

## Migration
Callers matching input failures on `api.decode` switch to `api.input`.

## Token impact
About 40 tokens.
