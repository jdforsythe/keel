// Spec: k.ui Rules E1803, E1805, E1806. Each is a compiler/check diagnostic over source text; no public runtime API of @keel/ui exposes it.
import { describe, it } from "vitest";

describe("k.ui: untestable from @keel/ui alone", () => {
  it.todo("E1803 style attribute or exported styles: untestable here; needs the compiler/check fixture harness");
  it.todo("E1805 lowercase intrinsic element in app code: untestable here; needs the compiler/check fixture harness");
  it.todo("E1806 standard slot name with another signature: untestable here; needs the compiler/check fixture harness");
});
