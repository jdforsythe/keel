import { it } from "vitest";

// Untestable at runtime: E1904 is a static diagnostic (k.check); spec defines no runtime behavior for it.
it.skip("E1904 keel.fields error names a path not in the action's input schema", () => {});
