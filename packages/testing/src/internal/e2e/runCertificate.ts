import { randomBytes, sign } from "node:crypto";
import { runKey } from "./runKey.ts";

/** One DER element: `tag`, its length in DER's form, then `body`. */
const der = (tag: number, body: Buffer): Buffer => {
  const n = body.length;
  const len = n < 0x80 ? Buffer.from([n]) : n < 0x100 ? Buffer.from([0x81, n]) : Buffer.from([0x82, n >> 8, n & 0xff]);
  return Buffer.concat([Buffer.from([tag]), len, body]);
};
const seq = (...parts: Buffer[]): Buffer => der(0x30, Buffer.concat(parts));
const oid = (bytes: readonly number[]): Buffer => der(0x06, Buffer.from(bytes));
/** ecdsa-with-SHA256, 1.2.840.10045.4.3.2. */
const ECDSA_SHA256 = seq(oid([0x2a, 0x86, 0x48, 0xce, 0x3d, 0x04, 0x03, 0x02]));
/** The name `CN=keel e2e`, issuer and subject alike. */
const NAME = seq(der(0x31, seq(oid([0x55, 0x04, 0x03]), der(0x0c, Buffer.from("keel e2e", "utf8")))));
/** A fixed validity window: the browser trusts the key by its hash, not by dates, and the run reads no clock for it. */
const VALIDITY = seq(der(0x17, Buffer.from("250101000000Z")), der(0x17, Buffer.from("491231235959Z")));

const pem = (label: string, body: Buffer): string =>
  `-----BEGIN ${label}-----\n${(body.toString("base64").match(/.{1,64}/g) ?? []).join("\n")}\n-----END ${label}-----\n`;

/**
 * A self-signed certificate for `names` alone (its subject alternative names), on the run's key: what a serve's proxy
 * ends `https` to a mapped origin with (k.e2e-run Reach). Made per serve; nothing of it ships in a package.
 */
export function runCertificate(names: readonly string[]): { readonly cert: string; readonly key: string } {
  const k = runKey();
  const serial = randomBytes(16);
  serial[0] = (serial[0] ?? 0) & 0x7f;
  const san = seq(oid([0x55, 0x1d, 0x11]), der(0x04, seq(...names.map((n) => der(0x82, Buffer.from(n, "ascii"))))));
  const tbs = seq(
    der(0xa0, der(0x02, Buffer.from([2]))),
    der(0x02, serial),
    ECDSA_SHA256,
    NAME,
    VALIDITY,
    NAME,
    k.spki,
    der(0xa3, seq(san)),
  );
  const signature = sign("sha256", tbs, k.privateKey);
  const cert = seq(tbs, ECDSA_SHA256, der(0x03, Buffer.concat([Buffer.from([0]), signature])));
  return { cert: pem("CERTIFICATE", cert), key: k.pem };
}
