// Spec: k.runtime Conformance 4.
import { it } from "vitest";

// Untestable at runtime: "no JS shipped" is a build/emit property (k.compiler), not observable from runtime-dom.
it.todo("a page with no islands loads no runtime JS");
