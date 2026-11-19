import { isDigested } from "../../internal/isDigested.ts";

/** The parts of a stored token digest this version reads. */
type Parts = { readonly sim: boolean; readonly expiresAt: number | null; readonly digest: Buffer };

const EXP = /^exp=(\d{1,16})$/;

/**
 * A stored digest's parts, or why it cannot be read: `format` when it is not a `Digested` shape, `parameters` for an
 * id other than `sha256` and `sha256-sim`, a parameter other than `exp=<1 to 16 digits>`, or a digest that is not the
 * unpadded base64 of 32 bytes.
 */
export function readDigested(stored: unknown): Parts | "format" | "parameters" {
  if (typeof stored !== "string" || !isDigested(stored)) return "format";
  const parts = stored.split("$");
  const id = parts[1];
  if (id !== "sha256" && id !== "sha256-sim") return "parameters";
  let expiresAt: number | null = null;
  if (parts.length === 4) {
    const m = EXP.exec(parts[2] ?? "");
    if (m === null) return "parameters";
    expiresAt = Number(m[1]);
  }
  const text = parts[parts.length - 1] ?? "";
  const digest = Buffer.from(text, "base64");
  if (digest.length !== 32 || digest.toString("base64").replaceAll("=", "") !== text) return "parameters";
  return { sim: id === "sha256-sim", expiresAt, digest };
}
