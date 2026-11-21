// @vitest-environment happy-dom
// Spec: k.origins, Conformance "With no `origins`, and with `origins: {}`, a fixture's production and dev documents, `csp.txt` and shell policies are byte-equal to k.security's."
// Seed 1337 (sim ctx). This file: the production and dev documents. `csp.txt` and the shell policies: packages/cli/conformance/origins-none-byte-equal.test.ts.
// Also: an empty directive is the same declaration as none (k.origins Declaration).
import { describe, expect, test } from "vitest";
import { BASELINE, directivesOf, documentPolicy, nonceOf } from "./origins-support.ts";

const NONE = [undefined, {}, { img: {} }, { img: {}, media: {}, font: {}, connect: {}, frame: {} }] as const;

describe("k.origins: no declaration leaves the document policy as k.security's", () => {
  test("with no `origins`, and with `origins: {}`, a production document is byte-equal to k.security's", async () => {
    const plain = await documentPolicy(undefined, "production");
    expect(directivesOf(plain)).toEqual(BASELINE(nonceOf(plain)));
    for (const o of NONE) expect(await documentPolicy(o, "production")).toBe(plain);
  });

  test("with no `origins`, and with `origins: {}`, a dev document is byte-equal to k.security's", async () => {
    const plain = await documentPolicy(undefined, "dev");
    const ds = directivesOf(plain);
    expect(ds).toEqual(
      BASELINE(nonceOf(plain)).map((d) => (d === "style-src 'self'" ? "style-src 'self' 'unsafe-inline'" : d)),
    );
    for (const o of NONE) expect(await documentPolicy(o, "dev")).toBe(plain);
  });
});
