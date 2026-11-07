// Spec: std.sessions, clause "A valid POST to `sessions.ingest` is listed by `sessions.list` under its fingerprint; invalid input is 422 `keel.fields`; a sixth session of one fingerprint keeps 5 and counts 6."
// Seed 1337
import { describe, test } from "vitest";

// Gap: the spec does not say how a test gets the module's route manifest and topology for createApp (the package exports only record, replay, session, Session), the guard `sessions.reader` stub, nor the response body shape of `sessions.list`; so no request can be asserted.
// TODO 0092: unskip
describe.skip("std.sessions: ingest", () => {
  test.todo("A valid POST to `sessions.ingest` is listed by `sessions.list` under its fingerprint");
  test.todo("invalid input is 422 `keel.fields`");
  test.todo("a sixth session of one fingerprint keeps 5 and counts 6");
});
