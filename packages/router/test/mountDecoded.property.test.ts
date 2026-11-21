// k.mount-scope Test: no page matches a path that, decoded as the matcher decodes segments, is the mount path or lies
// under it; the test is case-sensitive, so `/API/auth` is any path.
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { contract } from "../src/contract/contract.ts";
import { compileRoutes } from "../src/internal/compileRoutes.ts";
import { matchUrl } from "../src/internal/matchUrl.ts";
import { manifest } from "../src/manifest.ts";

const c = contract("app", {
  "app.page": { path: "/:locale/:slug", params: s.object({ locale: s.string(), slug: s.string() }) },
  "app.deep": { path: "/:a/:b/:c", params: s.object({ a: s.string(), b: s.string(), c: s.string() }) },
});
const view = (): Node => document.createComment("");
const table = compileRoutes(manifest(c, { "app.page": { component: view }, "app.deep": { component: view } })).located;
const MOUNT = "/api/auth";
const kind = (url: string): string => matchUrl(table, url, MOUNT).kind;

/** Each character of `text` either as itself or percent-encoded. */
const spelled = (text: string): fc.Arbitrary<string> =>
  fc
    .array(fc.boolean(), { minLength: text.length, maxLength: text.length })
    .map((enc) =>
      [...text].map((ch, i) => (enc[i] ? `%${ch.charCodeAt(0).toString(16).padStart(2, "0")}` : ch)).join(""),
    );

describe("the mount, decoded", () => {
  it("`/%61pi/auth`, `/api/%61uth` and `/api%2Fauth` match no page", () => {
    for (const at of ["/%61pi/auth", "/api/%61uth", "/api%2Fauth", "/%61pi/auth/x"]) expect(kind(at)).toBe("notFound");
  });

  it("any spelling of the mount path, or under it, matches no page", () => {
    fc.assert(
      fc.property(spelled("api"), spelled("auth"), fc.boolean(), (a, b, under) => {
        expect(kind(`/${a}/${b}${under ? "/x" : ""}`)).toBe("notFound");
      }),
      { seed: 1337, numRuns: 200 },
    );
  });

  it("a case variant, or a path beside the mount, is matched as any path", () => {
    for (const at of ["/API/auth", "/api/Auth", "/en/about", "/api/authx", "/apix/auth"])
      expect(kind(at)).toBe("route");
  });
});
