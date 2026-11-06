import { s } from "@keel/schema";

/** `keel.unexpected` (k.errors): what a Boundary's fallback receives; `at` is the element id where the throw surfaced. */
export const Unexpected = s.error("keel.unexpected", s.object({ at: s.string() }));
