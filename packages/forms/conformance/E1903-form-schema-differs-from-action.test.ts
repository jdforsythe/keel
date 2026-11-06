import { it } from "vitest";

// Untestable at runtime: E1903 is a compile-time diagnostic (k.check), not observable via the public API.
it.skip("E1903 form schema differs from the target action's input schema", () => {});
