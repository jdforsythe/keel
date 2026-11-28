import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** The text of the file `rel` under `cwd`, or undefined when it cannot be read. */
export function readText(cwd: string, rel: string): string | undefined {
  try {
    return readFileSync(resolve(cwd, rel), "utf8");
  } catch {
    return undefined;
  }
}
