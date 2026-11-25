import { readFileSync } from "node:fs";
import { ledgerCount } from "@keel/check";
import { CODE_FILE } from "./CODE_FILE.ts";

/** The `unsafe(...)` calls and host elements over a library's files (real paths), its code files alone (k.library Ledger). */
export function libraryCount(files: readonly string[]): { unsafe: number; hostElements: number } {
  let unsafe = 0;
  let hostElements = 0;
  for (const file of files.filter((f) => CODE_FILE.test(f))) {
    const n = ledgerCount(file, readFileSync(file, "utf8"));
    unsafe += n.unsafe;
    hostElements += n.hostElements;
  }
  return { unsafe, hostElements };
}
