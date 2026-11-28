import { defect } from "@keel/schema";

/** The keys of `writes`, sorted; one key twice is E1606 (k.persist). */
export function distinctKeys(writes: readonly { readonly key: string }[]): string[] {
  const keys = writes.map((w) => w.key).sort();
  for (let i = 1; i < keys.length; i++)
    if (keys[i] === keys[i - 1]) return defect("commit names one key twice", { code: "E1606" });
  return keys;
}
