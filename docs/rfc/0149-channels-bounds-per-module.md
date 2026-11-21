# RFC 0149: std.channels: each serving module's bounds count its own channel routes' streams

Status: implemented (ADR-0171) under the RFC defaults (6: enforce in the library), for the orchestrator to confirm. For backlog 0777.

## Decisions
- D1: `perCaller`, `perAnonymous` and `maxStreams` of a module's `std['@keel/std-channels']` count the streams open in the process on that module's channel routes, not every module's.

## Problem
Read on `lane-w01` at `a9e4ad92`; red-team item `tasks/0338-s8-reach/proposed/red-team-6.md` 0777. `channelRoute` reads the opener module's config (`stdConfig(ctx, ...)[module]`) but counts every sink in the ctx's hub (`packages/std-channels/src/server/channelRoute.ts`, `internal/full.ts`). With two serving modules, one module's streams use up the other's bounds: module B with `maxStreams: 10` refuses every open while module A holds ten streams, and a caller's streams on A count against B's `perCaller`.

## Proposal
`internal/Sink.ts` gains `readonly module: string`; `channelRoute` sets it to the module its `id` names, and `full(sinks, caller, cfg)` is given only the sinks of that module. Delivery is unchanged: a publish reaches the instance's sinks whatever their module, as each channel instance is one name.

## Alternatives
- Say in the spec that every module's streams count against the opener's bounds: two modules' configs then interfere, and the strictest module decides for all.
- One process-wide config: config is per module everywhere else (k.module Std config).

## Spec diff
std.channels Serve: "A module's config `std['@keel/std-channels']: { perCaller?, perAnonymous?, maxStreams? }` (server-only; defaults 8, 64 and 1,000) bounds its channel routes' streams open in the process: of one caller, of all cookieless opens (caller `""`, counted against `perAnonymous`, never `perCaller`), and in all." The sentence on the kernel's own stream pool goes; docs/THREAT-MODEL.md states it. Conformance, appended: "- With two serving modules, each counts only the streams on its own channel routes: one at its `maxStreams` leaves the other's opens unaffected."

## Conformance diff
Addition only, by the `conformance-writer`: `packages/std-channels/conformance/per-module.test.ts`. A fixture that serves two modules may be added beside it; `fixtures.ts` does not change.

## Migration
None. An app with one serving module counts as before.

## Token impact
std.channels 1,497 to 1,499 tokens.
