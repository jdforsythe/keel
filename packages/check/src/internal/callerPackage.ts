import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { packageName } from "./packageName.ts";

/** This package's code folder (`src`, or `dist/src` when built): frames in it are not a caller. */
const OWN = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const readText = (file: string): string | undefined => {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return undefined;
  }
};

/**
 * The package (nearest `package.json` `name`) of the code that called into `@keel/check` now: the file of the first
 * stack frame outside this package's code folder. `null` when no frame names a file outside it.
 */
export function callerPackage(): string | null {
  let files: string[] = [];
  const prior = Error.prepareStackTrace;
  const limit = Error.stackTraceLimit;
  Error.stackTraceLimit = 30;
  Error.prepareStackTrace = (_e, frames) => {
    files = frames.map((f) => f.getFileName() ?? "");
    return "";
  };
  // Reading `stack` runs `prepareStackTrace`, which collects the frames' files.
  const stack = new Error("caller").stack;
  Error.prepareStackTrace = prior;
  Error.stackTraceLimit = limit;
  if (stack === undefined) return null;
  for (const f of files) {
    if (f === "" || f.startsWith("node:")) continue;
    const file = f.startsWith("file:") ? fileURLToPath(f) : f;
    if (!path.isAbsolute(file) || file.startsWith(`${OWN}${path.sep}`)) continue;
    return packageName(file, readText);
  }
  return null;
}
