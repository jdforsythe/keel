import { Write } from "@keel/std-offline";

/** A `Write` (`key`, `base`, owner `""`) as an outbox sends it: `key` parses into the branded id. */
export function write(key: string, base: number): Write {
  const r = Write.parse({ key, base, owner: "" });
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}
