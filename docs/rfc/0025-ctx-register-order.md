# RFC 0025: ctx register order independence

Status: implemented

## Problem
Red team 0085: a ctx created before `register(capability)` throws on access to that capability. That is an ordering invariant (PRINCIPLES 2).

## Proposal
Lazy resolution. `createCtx` records mode and seed in a private WeakMap (not a ctx property, so the ctx stays plain data). The accessor returned by `register` builds the implementation on first access for that ctx, from its mode and the seed derived from ctx seed and name, then caches it per ctx. No new error code, no new API. `register` no longer attaches anything at `createCtx`; a ctx not made by `createCtx` throws a plain Error on access.

## Alternatives
Forbid `register` after any ctx exists, with a static manifest and a new E16xx: adds a registration surface, a diagnostic and a global "any ctx exists" state, itself an ordering rule.

## Spec diff
k.ctx API: resolution is lazy, either order. Conformance: ctx before and after `register` both reach the capability in real, shell, sim.

## Conformance diff
Adds `packages/ctx/conformance/register-order.conformance.test.ts`. No existing test changes.

## Migration
None. Code that registered before creating ctxs behaves identically; sim factories run at first access, not at `createCtx`, still deterministic by seed.

## Token impact
About 70 tokens in k.ctx.
