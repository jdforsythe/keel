# RFC 0089: a submitted secret never returns in a response

Status: accepted by the orchestrator (2026-11-12) under WORKFLOW RFC default 4 (privacy by default). For backlog 0407.

## Problem
A document POST that fails its input schema is answered 422 with the page re-rendered and the submission restored. The markup left password inputs empty, but `#k-state` carried every submitted value under `form`, password and `s.secret` fields included, and `Field.bind` wrote an `s.secret` field's value into a text input's `value` attribute. Reproduced with a form holding a `type="password"` input over `s.string`, an `s.secret` field and an array of `s.secret`.

## Proposal
- A submitted value for an `s.secret` field (at any depth of the action's `input`) is dropped before the page renders; a union counts when any variant reaches a secret.
- A submitted value whose key is the `name` of a rendered `<input type="password">` is dropped from `#k-state` after the page renders.
- `Field.bind` writes no markup default for an `s.secret` field, as for `password` and `file` inputs. A hidden input is the app's choice.
- The field comes back empty; other fields keep their values and field errors still show.

Checked and already clean: the runtime 422 body, `keel.fields` `data`, the dev log stream, `inspect`, `observe`, the 303 path, `decodeStrings` issues.

## Alternatives
- **Restore nothing on a 422.** The user retypes every field for one mistake.
- **Schema secrets only.** A password input over `s.string` is the common case and the server knows it once the page has rendered.

## Spec diff
- **k.forms** Bindings: no default on an `s.secret` field. Submit: the re-render carries the submitted values less `s.secret` and password-input ones. One Conformance clause.

## Conformance diff
New file `packages/server/conformance/secret-submission-0089.test.ts`: for generated secret strings, a document POST and a runtime POST that fail validation answer 422 with the secret nowhere in the body.

## Migration
None. An app that relied on a secret field being refilled after a failed submit gets an empty field.

## Token impact
k.forms stays within its budget by dropping an RFC reference. `@keel/server` grows 208 B (17,346 B); the budget is re-based to 17 kB.
