import type { Gen } from "./Gen.ts";
import { isRecord } from "./isRecord.ts";

const COMPONENT = /^#\/components\/schemas\/([A-Za-z_$][\w$]*)$/;

/** The local const name for a `{ $ref: '#/components/schemas/<Name>' }` node, when `<Name>` can be one; else undefined. */
export function namedRef(g: Gen, node: unknown): string | undefined {
  if (!isRecord(node) || typeof node.$ref !== "string") return undefined;
  const name = COMPONENT.exec(node.$ref)?.[1];
  return name === undefined || g.reserved.has(name) ? undefined : name;
}
