import fs from "node:fs";

/** The parsed JSON of `file`; undefined when it cannot be read or parsed. */
export function readJson(file: string): unknown {
  try {
    const v: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
    return v;
  } catch {
    return undefined;
  }
}
