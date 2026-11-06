// Rule E1551 (`loader`/`action` outside a `*.server.ts` file): static check on source files; no runtime API in @keel/server. Untestable here (covered by @keel/check fixtures).
import { describe, it } from "vitest";

describe("k.server", () => {
  it.todo("E1551 loader or action declared outside a *.server.ts file");
});
