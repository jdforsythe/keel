import { it } from "vitest";

// Untestable at runtime: E1901 is a compile-time diagnostic (k.check/k.compiler), not observable via the public API.
it.skip("E1901 input inside a <Form> without field", () => {});
