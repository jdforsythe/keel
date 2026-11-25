import { s } from "@keel/schema";

/** A loader's `Result` that is ok. */
export const OkResult = s.object({ ok: s.literal(true), value: s.json() });
