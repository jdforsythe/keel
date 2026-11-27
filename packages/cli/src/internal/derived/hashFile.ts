import { readFileSync } from "node:fs";
import { sha256Hex } from "../sha256Hex.ts";

/** The SHA-256 of a file's bytes, or undefined when it cannot be read. */
export function hashFile(file: string): string | undefined {
  try {
    return sha256Hex(readFileSync(file));
  } catch {
    return undefined;
  }
}
