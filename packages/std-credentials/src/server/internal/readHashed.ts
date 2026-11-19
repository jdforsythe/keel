import { isHashed } from "../../internal/isHashed.ts";

/** The parts of a stored password hash this version reads. */
type Parts = {
  readonly id: "scrypt" | "scrypt-sim";
  readonly ln: number;
  readonly r: number;
  readonly p: number;
  readonly salt: Buffer;
  readonly key: Buffer;
  /** True when the salt and key texts are the canonical unpadded base64 of their bytes. */
  readonly exact: boolean;
};

const PARAMS = /^ln=([1-9][0-9]?),r=([1-9][0-9]?),p=([1-9][0-9]?)$/;
const b64 = (b: Buffer): string => b.toString("base64").replaceAll("=", "");

/**
 * A stored string's parts, or why it cannot be read: `format` when it is not a `Hashed` shape, `parameters` for an
 * id other than `scrypt` and `scrypt-sim`, a version mark, or parameters outside `ln` 14 to 20, `r` 8, `p` 1 to 5, a
 * salt of 8 to 64 bytes and a key of 16 to 64.
 */
export function readHashed(stored: unknown): Parts | "format" | "parameters" {
  if (typeof stored !== "string" || !isHashed(stored)) return "format";
  const parts = stored.split("$");
  const [, id, params, saltText, keyText] = parts;
  if (parts.length !== 5 || (id !== "scrypt" && id !== "scrypt-sim")) return "parameters";
  const m = PARAMS.exec(params ?? "");
  if (m === null) return "parameters";
  const ln = Number(m[1]);
  const r = Number(m[2]);
  const p = Number(m[3]);
  if (ln < 14 || ln > 20 || r !== 8 || p < 1 || p > 5) return "parameters";
  const salt = Buffer.from(saltText ?? "", "base64");
  const key = Buffer.from(keyText ?? "", "base64");
  if (salt.length < 8 || salt.length > 64 || key.length < 16 || key.length > 64) return "parameters";
  const exact = b64(salt) === saltText && b64(key) === keyText;
  return { id, ln, r, p, salt, key, exact };
}
