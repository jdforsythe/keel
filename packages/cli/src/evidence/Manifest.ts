import { s } from "@keel/schema";

/**
 * `manifest.json` of an evidence bundle (k.evidence): the app, the date of the run, the git source, each `@keel/*`
 * version, the signing key and its id, the check error and failed test counts, and each other file by hash and size.
 */
export const Manifest = s.object({
  v: s.literal(1),
  app: s.string(),
  at: s.string(),
  source: s.object({ commit: s.string(), dirty: s.boolean() }).nullable(),
  keel: s.record(s.string()),
  key: s.string(),
  keyId: s.string({ min: 16, max: 16 }),
  runs: s.object({ checkErrors: s.int({ min: 0 }), failedTests: s.int({ min: 0 }) }),
  files: s.array(s.object({ path: s.string(), sha256: s.string({ min: 64, max: 64 }), bytes: s.int({ min: 0 }) })),
});
