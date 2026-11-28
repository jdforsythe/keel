import { type KeyObject, createPrivateKey, createPublicKey } from "node:crypto";
import { keyIdOf } from "./keyIdOf.ts";

/** The DER SubjectPublicKeyInfo prefix of an Ed25519 key; the raw 32-byte key follows it. */
const SPKI_PREFIX = 12;

/**
 * The signing key of `keel evidence` (k.evidence Signing): `KEEL_EVIDENCE_KEY`, an Ed25519 private key as PKCS#8 PEM.
 * Returns the key, its raw public key in base64 and its `keyId`, or undefined when the value is absent, not a private
 * key, or not Ed25519 (E1061). The value itself never leaves this function.
 */
export function evidenceKey(
  pem: string | undefined,
): { readonly privateKey: KeyObject; readonly key: string; readonly keyId: string } | undefined {
  if (pem === undefined || !pem.includes("-----BEGIN PRIVATE KEY-----")) return undefined;
  try {
    const privateKey = createPrivateKey({ key: pem, format: "pem" });
    if (privateKey.asymmetricKeyType !== "ed25519") return undefined;
    const raw = createPublicKey(privateKey).export({ format: "der", type: "spki" }).subarray(SPKI_PREFIX);
    return { privateKey, key: raw.toString("base64"), keyId: keyIdOf(raw) };
  } catch {
    return undefined;
  }
}
