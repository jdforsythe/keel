// k.router Execution prose, RFC 0045: server-only internals live in `@keel/router/internal`, not in public API.
// Property seed: 1337 (no generated inputs; the export surface is finite).
import { describe, expect, it } from "vitest";

const MOVED = [
  "compileRoutes",
  "compileTable",
  "matchUrl",
  "needsBare",
  "parseSearch",
  "runGuard",
  "fieldsError",
  "formHandle",
];

describe("k.router internal subpath", () => {
  it("@keel/router has none of the moved names as runtime exports", async () => {
    const names = Object.keys(await import("@keel/router"));
    for (const n of MOVED) expect(names).not.toContain(n);
  });

  it("@keel/router/internal exports compileRoutes, matchUrl, runGuard and formHandle", async () => {
    const names = Object.keys(await import("@keel/router/internal"));
    for (const n of ["compileRoutes", "matchUrl", "runGuard", "formHandle"]) expect(names).toContain(n);
  });
});
