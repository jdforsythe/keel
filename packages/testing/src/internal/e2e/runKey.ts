import { type KeyObject, generateKeyPairSync } from "node:crypto";

let key: { readonly privateKey: KeyObject; readonly spki: Buffer; readonly pem: string } | undefined;

/**
 * The run's key pair (P-256), made on first use in this process and never written to a package or a file: its SPKI
 * (DER) is what the run's Chromium trusts by hash (k.e2e-run Reach), `pem` the private key a serve's proxy ends TLS with.
 */
export function runKey(): { readonly privateKey: KeyObject; readonly spki: Buffer; readonly pem: string } {
  if (key !== undefined) return key;
  const pair = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const spki = pair.publicKey.export({ type: "spki", format: "der" });
  const text = pair.privateKey.export({ type: "pkcs8", format: "pem" });
  key = { privateKey: pair.privateKey, spki, pem: typeof text === "string" ? text : text.toString("utf8") };
  return key;
}
