import { createPublicKey, verify } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { Manifest } from "../evidence/Manifest.ts";
import type { Input } from "../types/Input.ts";
import type { Io } from "../types/Io.ts";
import type { OutRecord } from "../types/OutRecord.ts";
import { BUNDLE_SCHEMAS } from "./BUNDLE_SCHEMAS.ts";
import type { Diag } from "./Diag.ts";
import type { Outcome } from "./Outcome.ts";
import { keyIdOf } from "./keyIdOf.ts";
import { makeDiag } from "./makeDiag.ts";
import { sha256Hex } from "./sha256Hex.ts";
import { summary } from "./summary.ts";

/** The DER SubjectPublicKeyInfo prefix of an Ed25519 public key; the raw 32-byte key follows it. */
const SPKI = Buffer.from("302a300506032b6570032100", "hex");
const SIGNED = new Set(["manifest.json", "manifest.sig"]);

/** Every entry of `dir` by name: a file's bytes, or null for anything that is not a file. Undefined: no directory. */
function entries(dir: string): Map<string, Buffer | null> | undefined {
  try {
    const out = new Map<string, Buffer | null>();
    for (const name of readdirSync(dir).sort()) {
      const at = join(dir, name);
      out.set(name, statSync(at).isFile() ? readFileSync(at) : null);
    }
    return out;
  } catch {
    return undefined;
  }
}

/** Whether `bytes` parse with `schema`: JSON, or for `.ndjson` each non-empty line. */
function parses(name: string, bytes: Buffer): boolean {
  const schema = BUNDLE_SCHEMAS.get(name);
  if (schema === undefined) return false;
  try {
    const text = bytes.toString("utf8");
    const docs = name.endsWith(".ndjson")
      ? text
          .split("\n")
          .filter((l) => l !== "")
          .map((l): unknown => JSON.parse(l))
      : [JSON.parse(text)];
    return docs.every((d) => schema.parse(d).ok);
  } catch {
    return false;
  }
}

/**
 * Whether `sig` (base64 and a newline, nothing else) is the Ed25519 signature of `message` under the raw public key `key` (base64); false for any
 * value that is not one.
 */
function signed(message: Buffer, sig: Buffer, key: string): boolean {
  try {
    const raw = Buffer.from(key, "base64");
    if (raw.length !== 32) return false;
    const pub = createPublicKey({ key: Buffer.concat([SPKI, raw]), format: "der", type: "spki" });
    const text = sig.toString("utf8");
    const bytes = Buffer.from(text.slice(0, -1), "base64");
    // Exactly the base64 the writer emits and a newline: base64 decoding skips stray characters, so it is re-encoded.
    return text === `${bytes.toString("base64")}\n` && verify(null, message, pub, bytes);
  } catch {
    return false;
  }
}

/**
 * `keel evidence --verify <dir> [--key <keyId>]` (k.evidence Verify). The manifest must parse and its signature
 * verify with its `key`, whose id is `keyId` and, when given, `--key`: otherwise E1063 and nothing else is trusted.
 * Then each listed file is re-hashed, every other file of the directory is unlisted, and each listed file parses with
 * its schema: E1062 naming the file. A bundle that verifies emits one `evidence` record.
 */
export function bundleVerify(input: Input, io: Io): Outcome {
  const shown = (input.verify ?? "").replace(/\/$/, "");
  const dir = resolve(io.cwd, shown);
  const at = (name: string): { path: string; see: string } => ({ path: `${shown}/${name}`, see: "k.evidence" });
  const fail = (diags: readonly Diag[]): Outcome => ({
    records: [...diags, summary("evidence --verify", diags, { files: 0 })],
    writes: [],
  });
  const files = entries(dir) ?? new Map<string, Buffer | null>();
  const bytes = files.get("manifest.json");
  const sig = files.get("manifest.sig");
  let parsed: unknown;
  try {
    parsed = bytes === undefined || bytes === null ? undefined : JSON.parse(bytes.toString("utf8"));
  } catch {
    parsed = undefined;
  }
  const manifest = Manifest.parse(parsed);
  if (!manifest.ok || bytes === undefined || bytes === null || sig === undefined || sig === null)
    return fail([makeDiag("E1063", "manifest.json or manifest.sig missing or unreadable", at("manifest.json"))]);
  const m = manifest.value;
  if (!signed(bytes, sig, m.key))
    return fail([makeDiag("E1063", `signature does not verify with key ${m.keyId}`, at("manifest.sig"))]);
  if (keyIdOf(Buffer.from(m.key, "base64")) !== m.keyId)
    return fail([makeDiag("E1063", `keyId ${m.keyId} is not the id of the manifest's key`, at("manifest.json"))]);
  if (input.key !== undefined && input.key !== m.keyId)
    return fail([makeDiag("E1063", `bundle signed by key ${m.keyId}, not --key ${input.key}`, at("manifest.json"))]);

  const diags: Diag[] = [];
  const listed = new Set(m.files.map((f) => f.path));
  for (const name of BUNDLE_SCHEMAS.keys())
    if (!listed.has(name)) diags.push(makeDiag("E1062", `${name} is not listed in the manifest`, at(name)));
  for (const f of m.files) {
    const got = files.get(f.path);
    if (!BUNDLE_SCHEMAS.has(f.path)) diags.push(makeDiag("E1062", `${f.path} is not a bundle file`, at(f.path)));
    else if (got === undefined || got === null) diags.push(makeDiag("E1062", `${f.path} missing`, at(f.path)));
    else if (got.length !== f.bytes || sha256Hex(got) !== f.sha256)
      diags.push(makeDiag("E1062", `${f.path} changed since signing`, at(f.path)));
    else if (!parses(f.path, got))
      diags.push(makeDiag("E1062", `${f.path} does not parse with its schema`, at(f.path)));
  }
  for (const name of files.keys())
    if (!SIGNED.has(name) && !listed.has(name))
      diags.push(makeDiag("E1062", `${name} is not listed in the manifest`, at(name)));
  if (diags.length > 0) return fail(diags);
  const record: OutRecord = { kind: "evidence", dir: shown, at: m.at, keyId: m.keyId, files: m.files.length };
  return { records: [record], writes: [] };
}
