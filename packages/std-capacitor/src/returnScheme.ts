const FILTER = (id: string): string => `
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="${id}"/>
            </intent-filter>`;
const URL_TYPES = (id: string): string => `	<key>CFBundleURLTypes</key>
	<array>
		<dict>
			<key>CFBundleURLName</key>
			<string>${id}</string>
			<key>CFBundleURLSchemes</key>
			<array>
				<string>${id}</string>
			</array>
		</dict>
	</array>
`;

/**
 * A Capacitor platform file with the shell's `id` registered as a URI scheme, the scheme of its return links
 * (k.return). `AndroidManifest.xml` gains, after its first intent filter (the launcher activity's), one with the
 * action `VIEW`, the categories `DEFAULT` and `BROWSABLE` and `<data android:scheme="<id>"/>`; a manifest that names
 * that scheme already is returned as it is. `Info.plist` gains `CFBundleURLTypes` with that one scheme before its last
 * `</dict>`; a plist that holds the key already is returned as it is.
 */
export function returnScheme(file: string, id: string): string {
  if (file.includes("<plist"))
    return file.includes("<key>CFBundleURLTypes</key>")
      ? file
      : file.replace(/<\/dict>\s*<\/plist>\s*$/, (end) => `${URL_TYPES(id)}${end}`);
  return file.includes(`android:scheme="${id}"`)
    ? file
    : file.replace("</intent-filter>", (end) => `${end}${FILTER(id)}`);
}
