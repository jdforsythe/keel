# RFC 0017: inspect endpoint and viewer

Status: draft

## Problem
Principle 6 says the runtime is queryable, but `keel inspect` reports I1055 and no running app exposes its graph, stores, or artifacts.

## Proposal
A running dev app serves `GET /__keel/inspect`: `{ live, graph: inspect(), stores: { [id]: { state, log } }, ids, a11y, routes }` (artifacts from `.keel/`). Node deployables: `createApp` in `mode: 'dev'`. Client-only apps: the compiler plugin's dev and preview servers; the live half comes from the open page, whose dev entry posts it to the same path when it changes (`live: false` until then). Loopback origins only. `keel inspect [url]` fetches and summarizes it; `apps/inspector`, a Keel app, renders it.

## Alternatives
- Viewer reads `window.__keel` through an iframe: app code may not touch `window` (E1252) and the origins differ.
- Subcommands `inspect state|deps|...`: one document is simpler.

## Spec diff
k.cli: `inspect [url]` row, an Inspect paragraph, E1056 (target unreachable or not an inspect document), two conformance lines. k.server: the dev log line drops `keel inspect log`.

## Migration
Additive; `inspect state|deps|tree|a11y|log` never shipped.

## Token impact
About 180 tokens in k.cli.
