# Task 0122: RFC wave 0024-0048

**Spec/PRD:** docs/rfc/0024-*.md through docs/rfc/0048-*.md · **Gate:** G3 · **Status:** closed

Umbrella plan written after the fact (2026-11-07) so the RFC work landed 2026-11-06/07 has PLAN evidence (CLAUDE.md rule 3). Each row was read from `git log --grep "rfc:00NN"`, `git show --name-status` and the RFC text; nothing here is newly run.

## Verification trailers
No commit in this wave carries a verification trailer. Each message is `rfc:NNNN <summary> (backlog ...)` plus `Co-Authored-By`. Where an RFC states its own verification (conformance additions, ADR acceptance), the row records that. Backlog 0115-0117 and RFC 0044/0047 follow-ups are recorded in tasks/BACKLOG.md.

## Deliverables
- [x] **RFC 0024: Spec catches up with red-team batch 2** (accepted; docs/rfc/0024-red-team-spec-catch-up.md)
  - commit adbbab5; backlog: none named; conformance added: compiler/conformance/url-poster.test.ts compiler/conformance/url-srcdoc-vbscript.test.ts forms/conformance/form-ids-stable.test.ts server/conformance/body-cap-413.test.ts server/conformance/inspect-post-origin.test.ts 
  - verification: none in commit; RFC status `accepted`
- [x] **RFC 0025: ctx register order independence** (accepted; docs/rfc/0025-ctx-register-order.md)
  - commit f4a99ad; backlog: none named; conformance added: ctx/conformance/register-order.conformance.test.ts 
  - verification: none in commit; RFC status `accepted`
- [x] **RFC 0026: s.secret() and reveal** (accepted; docs/rfc/0026-schema-secret.md)
  - commit 2e04ceb; backlog: none named; conformance added: schema/conformance/secret.test.ts 
  - verification: none in commit; RFC status `accepted`
- [x] **RFC 0027: Loaders and actions declare their route schemas; `url` replaces `location`** (accepted; docs/rfc/0027-loader-action-declarations.md)
  - commit 15861f6; backlog: (backlog 0100 remainder of 0086) ; conformance added: router/conformance/loader-params-inferred.test.ts server/conformance/loader-url-absolute.test.ts server/conformance/undo-own-caller.test.ts 
  - verification: none in commit; RFC status `accepted`
- [x] **RFC 0028: Typed `tx` payloads, log entry `meta`, `undoWhere`** (accepted; docs/rfc/0028-store-typed-tx-log-meta.md)
  - commit 3c6ff51; backlog: (backlog 0038; 0100 store part) ; conformance added: store/conformance/meta.test.ts store/conformance/payload-typed.test.ts store/conformance/undo-where.test.ts 
  - verification: none in commit; RFC status `accepted`
- [x] **RFC 0029: closed objects and member unions** (accepted; docs/rfc/0029-schema-closed-objects-member-unions.md)
  - commit c696ca3; backlog: (backlog 0039) ; conformance added: schema/conformance/closed-and-member-unions.test.ts 
  - verification: none in commit; RFC status `accepted`
- [x] **RFC 0030: Compiler error codes, E1501 scope, one a11y table** (accepted (ADR-0019); docs/rfc/0030-compiler-error-codes-a11y-table.md)
  - commit 78cb4db; backlog: (backlog 0041, 0046; 0100 compiler part) ; conformance added: compiler/conformance/E1000-syntax-error.test.ts compiler/conformance/E1501-asset-urls.test.ts compiler/conformance/build-eval-routes.test.ts testing/conformance/a11y-json-agreement.test.ts 
  - verification: none in commit; RFC status `accepted (ADR-0019)`
- [x] **RFC 0031: Check rules for endpoints, and malformed generated artifacts** (accepted; docs/rfc/0031-services-check-rules.md)
  - commit 698081f; backlog: (backlog 0051, 0069) ; conformance added: none
  - verification: none in commit; RFC status `accepted`
- [x] **RFC 0032: Conformance completion: k.reactive, k.store, k.ctx, k.errors** (accepted; docs/rfc/0032-conformance-completion-reactive-store-ctx-errors.md)
  - commit a26c627; backlog: (backlog 0057) ; conformance added: ctx/conformance/keel-test-env-sim.test.ts reactive/conformance/owner-effect-rerun.test.ts store/conformance/restore-different-initial.test.ts store/conformance/transaction-schema-valid-payloads.test.ts 
  - verification: none in commit; RFC status `accepted`
- [x] **RFC 0033: Conformance completion: k.compiler, k.component, k.runtime, k.ui** (accepted (ADR-0022); docs/rfc/0033-conformance-completion-compiler-component-runtime-ui.md)
  - commit 6106127; backlog: (backlog 0058; 0105, 0106 remain) ; conformance added: testing/conformance/compiler-a11y-no-e1702.test.ts testing/conformance/compiler-ids-find.test.ts testing/conformance/compiler-keel-dir-tamper.test.ts testing/conformance/component-children-jsx.test.ts testing/conformance/runtime-resume-state-fire.test.ts ui/conformance/base-elements-axe-core.test.ts 
  - verification: none in commit; RFC status `accepted (ADR-0022)`
- [x] **RFC 0034: Conformance completion for k.router, k.server, k.services** (accepted (ADR-0023); docs/rfc/0034-conformance-completion-router-server-services.md)
  - commit e7547b1; backlog: (backlog 0059) ; conformance added: services/conformance/E1651-check.test.ts services/conformance/E1652-check.test.ts services/conformance/E1653-check.test.ts services/conformance/decode-failure-all-2xx.test.ts services/conformance/never-throws-null-body.test.ts services/conformance/ok-decodes-output-transformed.test.ts services/conformance/openapi-client.test.ts services/conformance/status-errors-decoded-body.test.ts 
  - verification: none in commit; RFC status `accepted (ADR-0023)`
- [x] **RFC 0035: Conformance completion k.check, k.cli, k.module** (accepted (ADR-0024); docs/rfc/0035-conformance-completion-check-cli-module.md)
  - commit d1c3012; backlog: (backlog 0060) ; conformance added: check/conformance/E1753-E1754-E1755.test.ts check/conformance/fix-diffs.test.ts check/conformance/module-stdlib-schema-and-rules.test.ts cli/conformance/check-budget-injected10.test.ts cli/conformance/check-code-and-warnings.test.ts cli/conformance/inspect-endpoint.test.ts 
  - verification: none in commit; RFC status `accepted (ADR-0024)`
- [x] **RFC 0036: Conformance completion k.scaffold, k.testing** (accepted (ADR-0025); docs/rfc/0036-conformance-completion-scaffold-testing.md)
  - commit b460dbf; backlog: (backlog 0061, 0104; 0107, 0108 remain) ; conformance added: scaffold/conformance/service-file.test.ts scaffold/conformance/transaction-file.test.ts testing/conformance/properties-keeps-log-meta.test.ts 
  - verification: none in commit; RFC status `accepted (ADR-0025)`
- [x] **RFC 0037: `keel check` reads `.keel/` artifacts; documents load runtime JS only for islands** (accepted (ADR-0026); docs/rfc/0037-artifact-check-and-islands.md)
  - commit 6f53eae; backlog: (backlog 0105, 0106) ; conformance added: cli/conformance/artifact-tamper-e1005.test.ts server/conformance/document-islands.test.ts 
  - verification: none in commit; RFC status `accepted (ADR-0026)`
- [x] **RFC 0038: Conformance completion k.ctx, k.testing: real `keel test` and `keel ledger` runs** (accepted (ADR-0027); docs/rfc/0038-conformance-completion-ctx-testing-cli-runs.md)
  - commit 10be27e; backlog: (backlog 0107) ; conformance added: cli/conformance/ledger-diff-e1706-cli.test.ts cli/conformance/ledger-rung-promotion-cli.test.ts cli/conformance/test-sim-ctx.test.ts 
  - verification: none in commit; RFC status `accepted (ADR-0027)`
- [x] **RFC 0039: Service schema filename equals its export; k.scaffold conformance-covered** (accepted (ADR-0028); docs/rfc/0039-service-schema-filename.md)
  - commit 1fa39e9; backlog: (backlog 0108) ; conformance added: none
  - verification: none in commit; RFC status `accepted (ADR-0028)`
- [x] **RFC 0040: Rules triage** (accepted (ADR-0029); docs/rfc/0040-rules-triage.md)
  - commit 658bf37; backlog: (backlog 0062, 0101, 0109 part, 0110) ; conformance added: check/conformance/rules-rfc0040.test.ts 
  - verification: none in commit; RFC status `accepted (ADR-0029)`
- [x] **RFC 0041: Guards by reference, manifest-typed `routes.href`, scroll keyed by history entry, `Image src` as an asset** (accepted; docs/rfc/0041-router-references-typed-href-entry-scroll.md)
  - commit 644afef; backlog: (backlog 0044, 0103) ; conformance added: ui/conformance/image-src.test.ts 
  - verification: none in commit; RFC status `accepted`
- [x] **RFC 0042: Inspector hooks, a request-scope-free inspect graph, and `@keel/cli/testing`** (accepted (ADR-0031); docs/rfc/0042-inspector-hooks.md)
  - commit 7b39722; backlog: (backlog 0063, 0109) ; conformance added: cli/conformance/inspect-sections.test.ts server/conformance/inspect-graph-request-scope.test.ts server/conformance/inspect-sections.test.ts 
  - verification: none in commit; RFC status `accepted (ADR-0031)`
- [x] **RFC 0043: One way for schema validation, random ids, styling, button text, and pending state** (accepted; docs/rfc/0043-one-way-schema-ctx-ui-pending.md)
  - commit da7bfb4; backlog: (backlog 0064) ; conformance added: forms/conformance/form-has-no-loading.test.ts ui/conformance/one-way-style-and-button.test.ts 
  - commit bfe564b; backlog: backlog 0115-0117; handoff ; conformance added: none
  - verification: none in commit; RFC status `accepted`
- [x] **RFC 0044: Per-request server stores, caller meta, no `Transaction.payload`** (accepted; docs/rfc/0044-per-request-server-stores.md)
  - commit 47834a1; backlog: (backlog 0054, 0102) ; conformance added: server/conformance/caller-token.test.ts server/conformance/server-state-instances.test.ts 
  - commit 6ae1929; backlog: none named; conformance added: none
  - verification: none in commit; RFC status `accepted`
- [x] **RFC 0045: `Form action` is an `Href`, router internals behind `@keel/router/internal`, a symbol-keyed forms seam, no scaffold `plan`, E1205 restored; the TS7022 action cycle** (accepted; docs/rfc/0045-form-href-router-internal-forms-seam-e1205.md)
  - commit f25b5a6; backlog: (backlog 0113, 0112, 0065) ; conformance added: reactive/conformance/disposed-computed-e1205.test.ts router/conformance/form-href.test.ts router/conformance/internal-subpath.test.ts 
  - verification: none in commit; RFC status `accepted`
- [x] **RFC 0046: node documents load a resume entry that exists; one owner for `Topology` and `StyleUsage`** (accepted (ADR-0035); docs/rfc/0046-node-resume-entry-topology-owner.md)
  - commit e462e73; backlog: (backlog 0111, 0065 row 13) ; conformance added: server/conformance/resume-entry.test.ts 
  - verification: none in commit; RFC status `accepted (ADR-0035)`
- [x] **RFC 0047: Stdlib wave 0, one module per extension point, and the k.module `std` key** (accepted (ADR-0036); docs/rfc/0047-stdlib-wave-0.md)
  - commit 2b90ef3; backlog: (backlog 0067) ; conformance added: check/conformance/module-E1158-std-config.test.ts std-brands/conformance/brands.test.ts std-geo/conformance/geo.test.ts std-health/conformance/app-import.test.ts std-health/conformance/check-package.test.ts std-health/conformance/href.test.ts std-health/conformance/manifest-parses.test.ts std-health/conformance/serve.test.ts std-money/conformance/add.test.ts std-money/conformance/doc.test.ts std-money/conformance/format.test.ts std-money/conformance/parse-rejects.test.ts std-money/conformance/registry.test.ts std-money/conformance/roundtrip.test.ts std-report/conformance/formatter-twice.test.ts std-report/conformance/render.test.ts std-report/conformance/tally.test.ts std-timings/conformance/ctx-isolation.test.ts std-timings/conformance/duplicate-E1057.test.ts std-timings/conformance/inspect-section.test.ts std-timings/conformance/outcome.test.ts std-timings/conformance/record.test.ts 
  - commit 7d5e083; backlog: none named; conformance added: none
  - verification: none in commit; RFC status `accepted (ADR-0036)`
- [x] **RFC 0048: a production node deployable serves its built client** (accepted (ADR-0037); docs/rfc/0048-node-client-build.md)
  - commit e98b267; backlog: (backlog 0116) ; conformance added: server/conformance/build-assets.test.ts 
  - verification: none in commit; RFC status `accepted (ADR-0037)`

## Steps
1. [x] Collect shas, backlog refs and added conformance files per RFC.
2. [x] Add the 13 missing changesets (0024, 0025, 0028, 0031-0038, 0040, 0043).
3. [x] Update docs/THREAT-MODEL.md against RFCs 0022, 0024, 0026, 0037, 0042, 0044, 0048; add `verified:` line.

## Decisions
- D1: Missing verification trailers are recorded as missing, not reconstructed. Future RFC commits state `pnpm check`/`pnpm test` results in the body.
- D2: Changesets use `patch` (pre-1.0) and list the packages each commit touched.

## Verification
- [x] `node tooling/docs-freshness.mjs`
- [x] `node tooling/voice-lint.mjs`
- [ ] `pnpm exec changeset status` fails on a pre-existing file (.changeset/rfc-0005-bounds.md has a malformed frontmatter); not from this task.

## Next action
CLOSED. Fix rfc-0005-bounds.md frontmatter (owner of .changeset history).
