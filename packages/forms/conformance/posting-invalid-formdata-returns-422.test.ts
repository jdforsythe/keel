import { it } from "vitest";

// Untestable here: k.server clause (no-runtime POST path); covered by packages/server conformance.
it.skip("with the runtime absent, posting invalid FormData returns 422 HTML containing the submitted values and messages", () => {});
