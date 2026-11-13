import type { StdData } from "@keel/compiler";
import { readStd } from "@keel/compiler/std/readStd";
import { codedError } from "./codedError.ts";

/** `createApp({ std })`'s file, read once at startup (k.module Std config): missing, malformed or hand-edited is E1160. */
export async function loadStd(file: string): Promise<StdData> {
  const fs = await import("node:fs/promises");
  const text = await fs.readFile(file, "utf8").catch(() => undefined);
  const data = text === undefined ? undefined : readStd(text);
  if (data === undefined)
    throw codedError("E1160", "std: the file is missing, malformed or hand-edited; run `keel build`");
  return data;
}
