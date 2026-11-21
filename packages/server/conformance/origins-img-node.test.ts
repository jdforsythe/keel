// @vitest-environment happy-dom
// Spec: k.origins, Conformance "`img: { 'https://a.example': 'r', 'https://b.example': 'r' }` on a `node` deployable: its documents carry `img-src 'self' https://a.example https://b.example`, the rest as k.security; its JSON responses are unchanged."
// Spec: k.origins, Policy "`img`, `font` and `connect` append theirs to `img-src`, `font-src` and `connect-src` after `'self'`"; "So do a `node` document in production and dev (Report-Only)"; "A response that is not a document keeps `default-src 'none'; frame-ancestors 'none'`."
// Seed 1337 (fc.assert below; sim ctx seed 1337).
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { BASELINE, SEED, appWith, directivesOf, documentPolicy, nonceOf } from "./origins-support.ts";

const IMG = { img: { "https://a.example": "r", "https://b.example": "r" } };
const withImg = (nonce: string, list: string[]): string[] =>
  BASELINE(nonce).map((d) => (d === "img-src 'self'" ? `img-src 'self' ${list.join(" ")}` : d));

describe("k.origins: img on a node deployable", () => {
  test("`img` of two origins: a production document carries `img-src 'self' https://a.example https://b.example`, the rest as k.security", async () => {
    const policy = await documentPolicy(IMG, "production");
    expect(directivesOf(policy)).toEqual(withImg(nonceOf(policy), ["https://a.example", "https://b.example"]));
  });

  test("`img` of two origins: a dev document carries the same `img-src`, the rest as k.security's dev policy", async () => {
    const policy = await documentPolicy(IMG, "dev");
    const expected = withImg(nonceOf(policy), ["https://a.example", "https://b.example"]).map((d) =>
      d === "style-src 'self'" ? "style-src 'self' 'unsafe-inline'" : d,
    );
    expect(directivesOf(policy)).toEqual(expected);
  });

  test("`img` of two origins: its JSON responses are unchanged", async () => {
    for (const mode of ["dev", "production"] as const) {
      const app = await appWith(IMG, mode);
      const res = await app.fetch(new Request("http://localhost/live", { headers: { accept: "application/json" } }));
      const policy =
        res.headers.get("content-security-policy") ?? res.headers.get("content-security-policy-report-only") ?? "";
      expect(directivesOf(policy)).toEqual(["default-src 'none'", "frame-ancestors 'none'"]);
    }
  });

  test("declared origins keep declaration order, after `'self'`, in `img-src`, `font-src` and `connect-src`", async () => {
    const host = fc.stringMatching(/^[a-z]{3,10}$/);
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(host, { minLength: 1, maxLength: 16 }),
        fc.constantFrom("img", "font", "connect"),
        async (hosts, key) => {
          const list = hosts.map((h) => `https://${h}.example`);
          const origins = { [key]: Object.fromEntries(list.map((o) => [o, "r"])) };
          const policy = await documentPolicy(origins, "production");
          const ds = directivesOf(policy);
          const expected = BASELINE(nonceOf(policy)).map((d) =>
            d === `${key}-src 'self'` ? `${d} ${list.join(" ")}` : d,
          );
          expect(ds).toEqual(expected);
        },
      ),
      { seed: SEED, numRuns: 20 },
    );
  });
});
