import { s } from "@keel/schema";

/** The record `keel evidence --verify` emits for a bundle that verifies (k.evidence Verify): `files` is a count. */
export const EvidenceRecord = s.object({
  kind: s.literal("evidence"),
  dir: s.string(),
  at: s.string(),
  keyId: s.string(),
  files: s.int({ min: 0 }),
});
