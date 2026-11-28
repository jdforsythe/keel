import { s } from "@keel/schema";

/** A storage call or a timer failed without an answer: a write or read that threw, a cancelled wait. Nothing is kept of it. */
export const Failed = s.error("offline.failed", s.object({}));
