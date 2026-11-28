// k.return: `returnScheme` registers the shell's id as a URI scheme in a Capacitor platform file, once. Seed 1337 for the property.
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
