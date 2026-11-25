// Spec: k.evidence, clause "`security.json` holds the k.security policy with `<nonce>` for each `node` deployable and the `csp.txt` text for each `client` one."
// Seed: 1337. ASSUMED (the spec gives `security.json` no field names): found by text. The fixture has `node` deployable
// `web` and `client` deployable `app`; the `csp.txt` text is the file `keel build` writes at `dist/app/csp.txt`.
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  TEST_KEY_PEM,
  fixtureTree,
  keelEvidence,
  parseJson,
  project,
  readTree,
  removeDir,
  writeBundle,
} from "./evidence-fixture.ts";

const SLOW = 600_000;
let dir = "";
let base = "";
let security: unknown;
let text = "";
let strings: string[] = [];

function leaves(value: unknown, into: string[]): string[] {
  if (typeof value === "string") into.push(value);
  else if (Array.isArray(value)) for (const v of value) leaves(v, into);
  else if (typeof value === "object" && value !== null) {
    for (const [k, v] of Object.entries(value)) {
      into.push(k);
      leaves(v, into);
    }
  }
  return into;
}

beforeAll(() => {
  dir = project(fixtureTree());
  const written = writeBundle(dir, TEST_KEY_PEM);
  base = written.base;
  security = parseJson(readTree(written.out).get("security.json"));
  text = JSON.stringify(security);
  strings = leaves(security, []);
}, SLOW);
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  removeDir(base);
});

describe("k.evidence: security.json", () => {
  test(
    "`security.json` holds the k.security policy with `<nonce>` for each `node` deployable",
    () => {
      expect(text).toContain("web");
      const policy = strings.find((s) => s.includes("script-src 'nonce-<nonce>' 'strict-dynamic'"));
      expect(policy).toBeDefined();
      for (const directive of [
        "default-src 'none'",
        "style-src 'self'",
        "require-trusted-types-for 'script'",
        "trusted-types keel",
        "frame-ancestors 'none'",
        "report-uri /__keel/csp",
      ])
        expect(policy).toContain(directive);
    },
    SLOW,
  );

  test(
    "`security.json` holds the six response headers k.security sends for each `node` deployable",
    () => {
      for (const header of [
        "X-Content-Type-Options",
        "Referrer-Policy",
        "Cross-Origin-Opener-Policy",
        "Cross-Origin-Resource-Policy",
        "X-Frame-Options",
        "Permissions-Policy",
      ])
        expect(strings, header).toContain(header);
    },
    SLOW,
  );

  test(
    "`security.json` holds the `csp.txt` text for each `client` deployable",
    () => {
      const built = keelEvidence(dir, ["build"]);
      expect(built.status).toBe(0);
      const csp = readFileSync(join(dir, "dist", "app", "csp.txt"), "utf8").trim();
      expect(csp).toContain("script-src 'self'");
      expect(text).toContain("app");
      expect(strings.some((s) => s.includes(csp))).toBe(true);
      expect(csp).not.toContain("nonce");
    },
    SLOW,
  );
});
