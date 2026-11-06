import { isReadable } from "./isReadable.ts";
import { isRecord } from "./isRecord.ts";
import { styleProps } from "./styleProps.ts";

const KEYS: readonly string[] = [...styleProps, "states", "class"];

function dynamic(x: unknown, keys: readonly string[] | undefined): boolean {
  if (isReadable(x)) return true;
  if (!isRecord(x)) return false;
  for (const key of keys ?? Object.keys(x)) {
    const d = Object.getOwnPropertyDescriptor(x, key);
    if (d === undefined) continue;
    if (d.get !== undefined || dynamic(d.value, undefined)) return true;
  }
  return false;
}

/** True when any style value is a signal/computed or a getter prop (compiled dynamic expression). */
export function isDynamic(props: Readonly<Record<string, unknown>>): boolean {
  return dynamic(props, KEYS);
}
