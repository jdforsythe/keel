// k.return: `returnScheme` registers the shell's id as a URI scheme in a Capacitor platform file, once, and the
// `keel-capacitor-scheme` tool applies it in a shell build's folder. Seed 1337 for the property.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import fc from "fast-check";
import { expect, test } from "vitest";
import { returnScheme } from "../src/returnScheme.ts";

const MANIFEST = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application android:label="@string/app_name">
        <activity android:name=".MainActivity" android:launchMode="singleTask" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
        <provider android:name="androidx.core.content.FileProvider" android:exported="false" />
    </application>
</manifest>
`;
const PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
	<key>CFBundleIdentifier</key>
	<string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
	<key>UISupportedInterfaceOrientations</key>
	<array>
		<string>UIInterfaceOrientationPortrait</string>
	</array>
</dict>
</plist>
`;
const label = fc.stringMatching(/^[a-z][a-z0-9]{1,6}$/);
const ids = fc.tuple(label, label, label).map((p) => p.join("."));

test("the manifest gains one VIEW, DEFAULT, BROWSABLE filter for the id inside the launcher activity, once", () => {
  fc.assert(
    fc.property(ids, (id) => {
      const out = returnScheme(MANIFEST, id);
      const filters = [...out.matchAll(/<intent-filter\b[\s\S]*?<\/intent-filter>/g)].map((m) => m[0]);
      expect(filters).toHaveLength(2);
      expect(filters[0]).toContain("android.intent.category.LAUNCHER");
      for (const part of ["action.VIEW", "category.DEFAULT", "category.BROWSABLE", `<data android:scheme="${id}"/>`])
        expect(filters[1]).toContain(part);
      expect(out.indexOf(filters[1] ?? "")).toBeLessThan(out.indexOf("</activity>"));
      expect(out.replace(filters[1] ?? "", "").replace(/\n\s*\n/, "\n")).toBe(MANIFEST);
      expect(returnScheme(out, id)).toBe(out);
    }),
    { seed: 1337, numRuns: 30 },
  );
});

test("the plist gains CFBundleURLTypes with the id as its one scheme before the closing dict, once; an app's own stays", () => {
  fc.assert(
    fc.property(ids, (id) => {
      const out = returnScheme(PLIST, id);
      expect(out).toContain(
        `\t<key>CFBundleURLSchemes</key>\n\t\t\t<array>\n\t\t\t\t<string>${id}</string>\n\t\t\t</array>`,
      );
      expect(out.match(/<key>CFBundleURLTypes<\/key>/g)).toHaveLength(1);
      expect(out.endsWith("\t</array>\n</dict>\n</plist>\n")).toBe(true);
      expect(out.startsWith(PLIST.slice(0, PLIST.indexOf("</dict>\n</plist>")))).toBe(true);
      expect(returnScheme(out, id)).toBe(out);
      expect(returnScheme(out, `${id}.other`)).toBe(out);
    }),
    { seed: 1337, numRuns: 30 },
  );
});

test("keel-capacitor-scheme writes the scheme of capacitor.config.json's appId into the platform file, and fails without an appId or a known platform", () => {
  const bin = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "schemeBin.ts");
  const dir = mkdtempSync(join(tmpdir(), "keel-scheme-"));
  const run = (platform: string) => spawnSync(process.execPath, [bin, platform], { cwd: dir, encoding: "utf8" });
  try {
    expect(run("android").status).toBe(1);
    writeFileSync(join(dir, "capacitor.config.json"), JSON.stringify({ appId: "dev.keel.app", webDir: "www" }));
    expect(run("windows").stderr).toMatch(/^error: /);
    // A platform project without the file is left as it is.
    expect([run("ios").status, run("ios").stderr]).toEqual([0, ""]);
    mkdirSync(join(dir, "android/app/src/main"), { recursive: true });
    mkdirSync(join(dir, "ios/App/App"), { recursive: true });
    writeFileSync(join(dir, "android/app/src/main/AndroidManifest.xml"), MANIFEST);
    writeFileSync(join(dir, "ios/App/App/Info.plist"), PLIST);
    for (const platform of ["android", "ios", "android"]) {
      const r = run(platform);
      expect([r.status, r.stdout, r.stderr]).toEqual([0, "", ""]);
    }
    expect(readFileSync(join(dir, "android/app/src/main/AndroidManifest.xml"), "utf8")).toBe(
      returnScheme(MANIFEST, "dev.keel.app"),
    );
    expect(readFileSync(join(dir, "ios/App/App/Info.plist"), "utf8")).toBe(returnScheme(PLIST, "dev.keel.app"));
    expect(run("windows").status).toBe(1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
