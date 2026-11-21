// @vitest-environment happy-dom
// Spec: k.origins, Conformance "`media` and `frame` declared: `media-src` then `frame-src` directly follow `connect-src`, neither holding `'self'`."
// Spec: k.origins, Policy "`media` and `frame` add `media-src` then `frame-src` directly after `connect-src`, holding the declared origins alone."
// Seed 1337 (fc.assert below; sim ctx seed 1337).
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { BASELINE, SEED, directivesOf, documentPolicy, nonceOf } from "./origins-support.ts";

const insertAfterConnect = (base: string[], extra: string[]): string[] => {
  const at = base.indexOf("connect-src 'self'");
  return [...base.slice(0, at + 1), ...extra, ...base.slice(at + 1)];
};

describe("k.origins: media and frame", () => {
  test("`media` and `frame` declared: `media-src` then `frame-src` follow `connect-src`, neither holding `'self'`", async () => {
    const origins = { media: { "https://m.example": "r" }, frame: { "https://video.example": "r" } };
    for (const mode of ["production", "dev"] as const) {
      const policy = await documentPolicy(origins, mode);
      const ds = directivesOf(policy);
      const i = ds.indexOf("connect-src 'self'");
      expect(i).toBeGreaterThan(-1);
      expect(ds[i + 1]).toBe("media-src https://m.example");
      expect(ds[i + 2]).toBe("frame-src https://video.example");
      expect(ds[i + 3]).toBe("manifest-src 'self'");
      expect(policy).not.toMatch(/(media|frame)-src[^;]*'self'/);
    }
  });

  test("`media-src` and `frame-src` stay directly after `connect-src` when `connect` declares origins too", async () => {
    const origins = {
      connect: { "https://c.example": "r" },
      media: { "https://m.example": "r" },
      frame: { "https://video.example": "r" },
    };
    const ds = directivesOf(await documentPolicy(origins, "production"));
    const i = ds.indexOf("connect-src 'self' https://c.example");
    expect(i).toBeGreaterThan(-1);
    expect(ds.slice(i + 1, i + 3)).toEqual(["media-src https://m.example", "frame-src https://video.example"]);
  });

  test("`frame` alone adds `frame-src` and no `media-src`, and `media` alone adds `media-src` and no `frame-src`", async () => {
    const f = await documentPolicy({ frame: { "https://video.example": "r" } }, "production");
    expect(directivesOf(f)).toEqual(insertAfterConnect(BASELINE(nonceOf(f)), ["frame-src https://video.example"]));
    const m = await documentPolicy({ media: { "https://m.example": "r" } }, "production");
    expect(directivesOf(m)).toEqual(insertAfterConnect(BASELINE(nonceOf(m)), ["media-src https://m.example"]));
  });

  test("`media-src` and `frame-src` hold the declared origins alone, in declaration order", async () => {
    const host = fc.stringMatching(/^[a-z]{3,10}$/);
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(host, { minLength: 1, maxLength: 16 }),
        fc.uniqueArray(host, { minLength: 1, maxLength: 16 }),
        async (ms, fs) => {
          const m = ms.map((h) => `https://${h}.example`);
          const f = fs.map((h) => `https://${h}.example`);
          const origins = {
            media: Object.fromEntries(m.map((o) => [o, "r"])),
            frame: Object.fromEntries(f.map((o) => [o, "r"])),
          };
          const policy = await documentPolicy(origins, "production");
          expect(directivesOf(policy)).toEqual(
            insertAfterConnect(BASELINE(nonceOf(policy)), [`media-src ${m.join(" ")}`, `frame-src ${f.join(" ")}`]),
          );
        },
      ),
      { seed: SEED, numRuns: 20 },
    );
  });

  test("no other directive, and not Trusted Types, takes a declaration: all five declared leave `script-src`, `style-src` and Trusted Types as k.security", async () => {
    const all = {
      img: { "https://i.example": "r" },
      media: { "https://m.example": "r" },
      font: { "https://n.example": "r" },
      connect: { "https://c.example": "r" },
      frame: { "https://f.example": "r" },
    };
    const policy = await documentPolicy(all, "production");
    const ds = directivesOf(policy);
    for (const d of BASELINE(nonceOf(policy))) {
      if (/^(img|font|connect)-src /.test(d)) continue;
      expect(ds).toContain(d);
    }
    expect(ds).toHaveLength(BASELINE("x").length + 2);
  });
});
