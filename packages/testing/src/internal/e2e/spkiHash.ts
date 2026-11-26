import { X509Certificate, createHash } from "node:crypto";

/** The base64 SHA-256 of a certificate's public key (SPKI), as Chromium's `--ignore-certificate-errors-spki-list` takes it. */
export function spkiHash(pem: string): string {
  const der = new X509Certificate(pem).publicKey.export({ type: "spki", format: "der" });
  return createHash("sha256").update(der).digest("base64");
}
