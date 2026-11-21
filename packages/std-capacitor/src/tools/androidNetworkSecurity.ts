/** The `res/xml` resource a debug Android build with an `http:` origin points its manifest at. */
const NAME = "keel_network_security";
const ATTR = `android:networkSecurityConfig="@xml/${NAME}"`;

/**
 * Android's cleartext rule for a Capacitor build (k.shell Build 3): Android refuses `http:` requests from API 28 on, so
 * a debug build whose `KEEL_ORIGIN` is `http:` (a local server; k.shell allows `http:` on `localhost` only) gets a
 * network security config allowing cleartext to that origin's host and to no other, and the manifest names it. An
 * `https:` origin, or a release build, gets neither, and a config an earlier build added is taken out again, so
 * cleartext stays off. A manifest that already names another config is left as it is. `config` is the
 * `res/xml/keel_network_security.xml` text to write, or undefined when that file must not exist.
 */
export function androidNetworkSecurity(
  manifest: string,
  origin: string,
  release: boolean,
): { readonly manifest: string; readonly config: string | undefined } {
  const u = new URL(origin);
  const host = u.protocol === "http:" && !release ? u.hostname : undefined;
  const without = manifest.replace(new RegExp(`\\s+${ATTR}`), "");
  if (host === undefined || without.includes("android:networkSecurityConfig=") || !without.includes("<application"))
    return { manifest: without, config: undefined };
  const config = [
    '<?xml version="1.0" encoding="utf-8"?>',
    "<network-security-config>",
    '    <base-config cleartextTrafficPermitted="false" />',
    '    <domain-config cleartextTrafficPermitted="true">',
    `        <domain includeSubdomains="false">${host}</domain>`,
    "    </domain-config>",
    "</network-security-config>",
    "",
  ].join("\n");
  return { manifest: without.replace("<application", `<application\n        ${ATTR}`), config };
}
