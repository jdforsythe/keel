// Android's cleartext rule for a Capacitor build: an `http:` origin in a debug build allows cleartext to that host
// only; an `https:` origin or a release build allows none and takes out a rule an earlier build added.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { androidNetworkSecurity } from "../src/shell/androidNetworkSecurity.ts";

const MANIFEST = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <application
        android:allowBackup="true"
        android:theme="@style/AppTheme">
    </application>
</manifest>
`;
const ATTR = 'android:networkSecurityConfig="@xml/keel_network_security"';

describe("androidNetworkSecurity", () => {
  test("a debug build with an http: origin allows cleartext to its host only, and the manifest names the config", () => {
    const r = androidNetworkSecurity(MANIFEST, "http://localhost:4182", false);
    expect(r.manifest).toContain(`<application\n        ${ATTR}\n        android:allowBackup="true"`);
    expect(r.config).toContain('<base-config cleartextTrafficPermitted="false" />');
    expect(r.config).toContain('<domain-config cleartextTrafficPermitted="true">');
    expect(r.config).toContain('<domain includeSubdomains="false">localhost</domain>');
    expect(r.config?.match(/cleartextTrafficPermitted="true"/g)).toHaveLength(1);
  });

  test("an https: origin changes nothing and allows no cleartext", () => {
    expect(androidNetworkSecurity(MANIFEST, "https://golden-1.example", false)).toEqual({
      manifest: MANIFEST,
      config: undefined,
    });
    expect(androidNetworkSecurity(MANIFEST, "https://localhost:8443", false)).toEqual({
      manifest: MANIFEST,
      config: undefined,
    });
  });

  test("a release build allows no cleartext, whatever the origin", () => {
    expect(androidNetworkSecurity(MANIFEST, "http://localhost:4182", true)).toEqual({
      manifest: MANIFEST,
      config: undefined,
    });
  });

  test("a later https: or release build takes out the rule an http: build added", () => {
    const debug = androidNetworkSecurity(MANIFEST, "http://localhost:4182", false).manifest;
    expect(androidNetworkSecurity(debug, "https://golden-1.example", false)).toEqual({
      manifest: MANIFEST,
      config: undefined,
    });
    expect(androidNetworkSecurity(debug, "http://localhost:4182", true).manifest).toBe(MANIFEST);
  });

  test("building twice with an http: origin names the config once", () => {
    const once = androidNetworkSecurity(MANIFEST, "http://localhost:4182", false).manifest;
    expect(androidNetworkSecurity(once, "http://localhost:4182", false).manifest).toBe(once);
  });

  test("a manifest naming another config is left as it is and gets no cleartext rule", () => {
    const own = MANIFEST.replace("<application", '<application android:networkSecurityConfig="@xml/mine"');
    expect(androidNetworkSecurity(own, "http://localhost:4182", false)).toEqual({ manifest: own, config: undefined });
  });

  test("cleartext is allowed only for a debug build with an http: origin", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("http:", "https:"),
        fc.constantFrom("localhost", "golden-1.example"),
        fc.integer({ min: 1, max: 65535 }),
        fc.boolean(),
        fc.boolean(),
        (scheme, host, port, release, twice) => {
          const origin = `${scheme}//${host}:${port}`;
          let r = androidNetworkSecurity(MANIFEST, origin, release);
          if (twice) r = androidNetworkSecurity(r.manifest, origin, release);
          const open = scheme === "http:" && !release;
          expect(r.config !== undefined).toBe(open);
          expect(r.manifest.includes(ATTR)).toBe(open);
          if (r.config !== undefined) expect(r.config).toContain(`>${host}</domain>`);
        },
      ),
      { seed: 1337, numRuns: 200 },
    );
  });
});
