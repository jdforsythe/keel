import { dbError } from "./dbError.ts";

/** The keys of `writes`, sorted; one key twice is E1606 (k.persist). */
export function distinctKeys(writes: readonly { readonly key: string }[]): string[] {
  const keys = writes.map((w) => w.key).sort();
  for (let i = 1; i < keys.length; i++)
    if (keys[i] === keys[i - 1]) throw dbError("E1606", "commit names one key twice");
  return keys;
}
