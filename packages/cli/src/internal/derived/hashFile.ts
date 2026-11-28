import { readFileSync, statSync } from "node:fs";
import { sha256Hex } from "../sha256Hex.ts";

/**
 * A file's status change time must be this far before the moment its bytes were read for the digest to be kept: no
 * later write can then share that time, on a file system that counts in nanoseconds or in seconds.
 */
const SETTLED_NS = 2_000_000_000n;
/** Each regular file's digest by path, with the identity, size and times it had when its bytes were read. */
const kept = new Map<string, { readonly key: string; readonly sha256: string }>();

/**
 * The SHA-256 of a file's bytes, or undefined when it cannot be read. A regular file whose device, inode, size,
 * modification and status change times are those it had when this process last read it, whose status change time
 * was then at least two seconds old, gives that digest again without a read: a write, a rename over it or a time set
 * back (`cp -p`, `tar`, `utimes`) moves its status change time, which no process can set. `now` is the clock in
 * milliseconds the status change time is held against.
 */
export function hashFile(file: string, now: () => number = Date.now): string | undefined {
  let key: string | undefined;
  let settled = false;
  try {
    const s = statSync(file, { bigint: true, throwIfNoEntry: false });
    if (s === undefined) {
      kept.delete(file);
      return undefined;
    }
    if (s.isFile()) {
      key = `${String(s.dev)}:${String(s.ino)}:${String(s.size)}:${String(s.mtimeNs)}:${String(s.ctimeNs)}`;
      const hit = kept.get(file);
      if (hit !== undefined && hit.key === key) return hit.sha256;
      settled = s.ctimeNs < BigInt(Math.floor(now())) * 1_000_000n - SETTLED_NS;
    }
  } catch {
    key = undefined;
  }
  let sha256: string;
  try {
    sha256 = sha256Hex(readFileSync(file));
  } catch {
    kept.delete(file);
    return undefined;
  }
  if (key !== undefined && settled) kept.set(file, { key, sha256 });
  else kept.delete(file);
  return sha256;
}
